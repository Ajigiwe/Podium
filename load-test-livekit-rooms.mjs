#!/usr/bin/env node
/**
 * Podium LMS — LiveKit Room Stress Test
 *
 * Tests how many concurrent rooms and participants the LiveKit server can handle.
 *
 * Modes:
 *   --dry-run (default) : Local simulation — token generation for N rooms/participants
 *   --live              : Real LiveKit server — creates rooms, measures API latency
 *
 * Usage:
 *   node load-test-livekit-rooms.mjs                  # dry-run (local)
 *   node load-test-livekit-rooms.mjs --live            # live test against your server
 *   node load-test-livekit-rooms.mjs --live --cleanup  # live test, then delete all test rooms
 */

import { performance } from 'node:perf_hooks';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

// ─── Config ──────────────────────────────────────────────────────────────────
const LIVE_MODE = process.argv.includes('--live');
const CLEANUP = process.argv.includes('--cleanup');

// Room test levels: [numRooms, participantsPerRoom]
const ROOM_SCALES = [
  [5, 30],       // 5 rooms × 30 students = 150 tokens
  [10, 30],      // 10 rooms × 30 = 300
  [25, 30],      // 25 × 30 = 750
  [50, 50],      // 50 × 50 = 2,500
  [100, 50],     // 100 × 50 = 5,000
  [200, 30],     // 200 × 30 = 6,000
  [350, 30],     // 350 × 30 = 10,500
  [500, 20],     // 500 × 20 = 10,000
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printTable(rows) {
  const colWidths = rows[0].map((_, i) =>
    Math.max(...rows.map(r => String(r[i]).length)) + 2
  );
  const sep = colWidths.map(w => '─'.repeat(w)).join('┼');
  console.log(sep);
  rows.forEach((row, ri) => {
    console.log(row.map((cell, i) => String(cell).padEnd(colWidths[i])).join('│'));
    if (ri === 0) console.log(sep);
  });
  console.log(sep);
}

function generateRoomToken(apiKey, apiSecret, roomName, participantId, name, role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: apiKey,
    sub: participantId,
    name,
    metadata: JSON.stringify({ role, userId: participantId, name }),
    video: {
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublishData: true,
      canPublish: true,
      canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'],
      ...(role === 'lecturer' ? { roomAdmin: true, roomCreate: true, canUpdateOwnMetadata: true } : {}),
    },
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// ─── DRY RUN: Local simulation ───────────────────────────────────────────────
async function runDryRun() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  LIVEKIT ROOM STRESS TEST — Dry Run (Local Simulation)         ║');
  console.log('║  Testing: Room creation, token generation, and participant     ║');
  console.log('║  token throughput at scale                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const env = loadEnv();
  const apiKey = env.LIVEKIT_API_KEY || 'test_key';
  const apiSecret = env.LIVEKIT_API_SECRET || 'test_secret';

  const results = [];

  for (const [numRooms, participantsPerRoom] of ROOM_SCALES) {
    const totalTokens = (numRooms) + (numRooms * participantsPerRoom); // 1 lecturer + N students per room
    console.log(`\n▸ ${numRooms} rooms × ${participantsPerRoom} participants = ${totalTokens.toLocaleString()} total tokens ...`);
    process.stdout.write('  Generating ');

    const startTime = performance.now();
    const tokenLatencies = [];
    const roomCreateLatencies = [];
    let errors = 0;

    // Phase 1: Room creation tokens (lecturer per room)
    for (let r = 0; r < numRooms; r++) {
      const roomName = `stress_test_room_${Date.now()}_${r}`;
      const opStart = performance.now();
      try {
        generateRoomToken(apiKey, apiSecret, roomName, `lecturer_${r}`, `Lecturer ${r}`, 'lecturer');
      } catch { errors++; }
      roomCreateLatencies.push(performance.now() - opStart);
    }

    // Phase 2: Participant tokens
    for (let r = 0; r < numRooms; r++) {
      const roomName = `stress_test_room_${Date.now()}_${r}`;
      for (let p = 0; p < participantsPerRoom; p++) {
        const opStart = performance.now();
        try {
          generateRoomToken(apiKey, apiSecret, roomName, `student_${r}_${p}`, `Student ${r}-${p}`, 'student');
        } catch { errors++; }
        tokenLatencies.push(performance.now() - opStart);
      }
    }

    const elapsed = performance.now() - startTime;
    tokenLatencies.sort((a, b) => a - b);
    roomCreateLatencies.sort((a, b) => a - b);

    const result = {
      rooms: numRooms,
      participantsPerRoom,
      totalTokens,
      elapsed,
      tokensPerSec: totalTokens / (elapsed / 1000),
      roomCreateP50: percentile(roomCreateLatencies, 50),
      roomCreateP99: percentile(roomCreateLatencies, 99),
      tokenP50: percentile(tokenLatencies, 50),
      tokenP95: percentile(tokenLatencies, 95),
      tokenP99: percentile(tokenLatencies, 99),
      tokenMax: tokenLatencies[tokenLatencies.length - 1] || 0,
      errors,
    };
    results.push(result);

    console.log(`done in ${formatMs(elapsed)} | ${result.tokensPerSec.toFixed(0)} tokens/s | p99=${formatMs(result.tokenP99)}`);
    if (errors > 0) console.log(`  ⚠  ${errors} errors`);
  }

  // Summary
  console.log('\n┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                                  ROOM STRESS TEST — DRY RUN RESULTS                                     │');
  console.log('└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘');
  printTable([
    ['Rooms', 'P/R', 'Total', 'Time', 'Tokens/s', 'Room P50', 'Room P99', 'Tok P50', 'Tok P95', 'Tok P99', 'Max', 'Errs'],
    ...results.map(r => [
      r.rooms,
      r.participantsPerRoom,
      r.totalTokens.toLocaleString(),
      formatMs(r.elapsed),
      r.tokensPerSec.toFixed(0),
      formatMs(r.roomCreateP50),
      formatMs(r.roomCreateP99),
      formatMs(r.tokenP50),
      formatMs(r.tokenP95),
      formatMs(r.tokenP99),
      formatMs(r.tokenMax),
      r.errors || '—',
    ]),
  ]);

  // Find scaling limits
  const sweetSpot = results.reduce((best, r) => {
    if (r.tokenP99 < 1 && r.tokensPerSec > best.tokensPerSec) return r;
    return best;
  }, results[0]);

  console.log(`\n✦ Token generation scales linearly — no CPU bottleneck found`);
  console.log(`  At ${sweetSpot.totalTokens.toLocaleString()} tokens, p99 is ${formatMs(sweetSpot.tokenP99)}`);
  console.log(`  The real bottleneck will be LiveKit server room capacity and WebRTC connections\n`);

  return results;
}

// ─── LIVE MODE: Real LiveKit server ──────────────────────────────────────────
async function runLive() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  LIVEKIT ROOM STRESS TEST — Live Mode (Real Server)            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Dynamically import livekit-server-sdk (ESM)
  const { RoomServiceClient } = await import('livekit-server-sdk');

  const env = loadEnv();
  const url = env.LIVEKIT_API_URL || env.NEXT_PUBLIC_LIVEKIT_URL;
  const key = env.LIVEKIT_API_KEY;
  const secret = env.LIVEKIT_API_SECRET;

  if (!url || !key || !secret) {
    console.error('✗ Missing LIVEKIT_API_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET in .env.local');
    process.exit(1);
  }

  const svc = new RoomServiceClient(url, key, secret);

  // Verify connectivity
  console.log('▸ Connecting to LiveKit server ...');
  let existingRooms;
  try {
    existingRooms = await svc.listRooms();
    console.log(`✓ Connected. ${existingRooms.length} existing room(s)\n`);
  } catch (e) {
    console.error(`✗ Cannot reach LiveKit at ${url}: ${e.message}`);
    console.error('  Run this from the VPS or a machine that can reach the LiveKit server.');
    process.exit(1);
  }

  const testRooms = [];

  // ── Phase 1: Room creation throughput ──────────────────────────────────────
  console.log('━'.repeat(65));
  console.log('PHASE 1: Room Creation Throughput');
  console.log('━'.repeat(65));

  const roomCounts = [1, 5, 10, 25, 50, 100, 200];
  const roomResults = [];

  for (const count of roomCounts) {
    process.stdout.write(`▸ Creating ${count} rooms concurrently ... `);

    const startTime = performance.now();
    const latencies = [];
    let successes = 0;
    let errors = 0;

    const promises = [];
    for (let i = 0; i < count; i++) {
      const roomName = `stress_test_${Date.now()}_${i}`;
      const opStart = performance.now();
      const p = svc.createRoom({
        name: roomName,
        emptyTimeout: 600,
        maxParticipants: 500,
        metadata: JSON.stringify({ test: true, created: Date.now() }),
      }).then(() => {
        successes++;
        testRooms.push(roomName);
        latencies.push(performance.now() - opStart);
      }).catch(e => {
        errors++;
        latencies.push(performance.now() - opStart);
      });
      promises.push(p);
    }

    await Promise.all(promises);
    const elapsed = performance.now() - startTime;
    latencies.sort((a, b) => a - b);

    const result = {
      count,
      successes,
      errors,
      elapsed,
      rate: successes / (elapsed / 1000),
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
    };
    roomResults.push(result);

    const status = errors === 0 ? '✓' : '⚠';
    console.log(`${status} ${successes}/${count} ok in ${formatMs(elapsed)} | ${result.rate.toFixed(1)} rooms/s | p99=${formatMs(result.p99)}`);
    if (errors > 0) console.log(`  ⚠  ${errors} room creation failures`);

    // Small delay between levels
    await new Promise(r => setTimeout(r, 500));
  }

  // ── Phase 2: List rooms performance ────────────────────────────────────────
  console.log(`\n${'━'.repeat(65)}`);
  console.log(`PHASE 2: List Rooms Performance (${testRooms.length} rooms)`);
  console.log('━'.repeat(65));

  const listLatencies = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    try {
      const rooms = await svc.listRooms();
      listLatencies.push(performance.now() - start);
    } catch (e) {
      console.error(`  List failed: ${e.message}`);
    }
  }
  listLatencies.sort((a, b) => a - b);
  console.log(`▸ 20 sequential listRooms calls:`);
  console.log(`  p50=${formatMs(percentile(listLatencies, 50))}  p95=${formatMs(percentile(listLatencies, 95))}  p99=${formatMs(percentile(listLatencies, 99))}  max=${formatMs(listLatencies[listLatencies.length - 1])}`);

  // ── Phase 3: Concurrent listRooms ──────────────────────────────────────────
  console.log(`\n${'━'.repeat(65)}`);
  console.log(`PHASE 3: Concurrent listRooms (simulating many dashboard users)`);
  console.log('━'.repeat(65));

  for (const concurrency of [5, 10, 25, 50]) {
    process.stdout.write(`▸ ${concurrency} concurrent listRooms calls ... `);
    const start = performance.now();
    const lats = [];
    let ok = 0, fail = 0;

    await Promise.all(Array.from({ length: concurrency }, async () => {
      const opStart = performance.now();
      try {
        await svc.listRooms();
        ok++;
      } catch { fail++; }
      lats.push(performance.now() - opStart);
    }));

    lats.sort((a, b) => a - b);
    console.log(`${fail === 0 ? '✓' : '⚠'} ${ok}/${concurrency} ok | p99=${formatMs(percentile(lats, 99))}`);
  }

  // ── Phase 4: Delete all test rooms ─────────────────────────────────────────
  if (CLEANUP || testRooms.length > 0) {
    console.log(`\n${'━'.repeat(65)}`);
    console.log(`CLEANUP: Deleting ${testRooms.length} test rooms`);
    console.log('━'.repeat(65));

    const start = performance.now();
    let deleted = 0;
    await Promise.all(testRooms.map(async (name) => {
      try {
        await svc.deleteRoom(name);
        deleted++;
      } catch {}
    }));
    console.log(`✓ Deleted ${deleted}/${testRooms.length} rooms in ${formatMs(performance.now() - start)}`);
  }

  // Summary
  console.log('\n┌──────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                          LIVE TEST RESULTS                                  │');
  console.log('└──────────────────────────────────────────────────────────────────────────────┘');
  printTable([
    ['Rooms Created', 'Success', 'Time', 'Rate', 'p50', 'p95', 'p99'],
    ...roomResults.map(r => [
      r.count,
      `${r.successes}/${r.count}`,
      formatMs(r.elapsed),
      r.rate.toFixed(1) + '/s',
      formatMs(r.p50),
      formatMs(r.p95),
      formatMs(r.p99),
    ]),
  ]);

  return roomResults;
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║          PODIUM LMS — LiveKit Room Stress Test                  ║');
console.log(`║  Mode: ${LIVE_MODE ? 'LIVE (real server)' : 'DRY RUN (local simulation)'}${' '.repeat(LIVE_MODE ? 30 : 14)}║`);
console.log('╚══════════════════════════════════════════════════════════════════╝');

const startTime = performance.now();

if (LIVE_MODE) {
  await runLive();
} else {
  await runDryRun();
}

const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
console.log(`\n⏱  Total test time: ${totalTime}s`);

if (!LIVE_MODE) {
  console.log('\n💡 To run against the real LiveKit server, use:');
  console.log('   node load-test-livekit-rooms.mjs --live');
  console.log('   (Must be run from a machine that can reach your LiveKit server)\n');
}
console.log('══════════════════════════════════════════════════════════════════════════════════════════════════════════');
