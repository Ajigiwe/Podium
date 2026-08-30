#!/usr/bin/env node
/**
 * Podium LMS — LiveKit Participant Connection Stress Test
 *
 * Connects fake participants to LiveKit via WebSocket signal connection.
 * Tests: connection success rate, latency, and max concurrent connections.
 */

import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

// ─── Config ──────────────────────────────────────────────────────────────────
const SCALES = [5, 10, 25, 50, 100, 200];
const CONNECTION_TIMEOUT_MS = 10_000;
const HOLD_TIME_MS = 3_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadEnv() {
  const raw = readFileSync('.env.local', 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.ceil((p / 100) * sorted.length) - 1];
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function generateToken(apiKey, apiSecret, roomName, identity, name) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: apiKey, sub: identity, name,
    video: { room: roomName, roomJoin: true, canSubscribe: true, canPublishData: true, canPublish: true,
      canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'] },
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// ─── LiveKit Signal Connection ───────────────────────────────────────────────
async function connectParticipant(livekitUrl, token, identity) {
  const wsModule = await import('ws');
  const WS = wsModule.default;

  return new Promise((resolve) => {
    const opStart = performance.now();
    const timeout = setTimeout(() => {
      resolve({ ok: false, latency: performance.now() - opStart, ws: null });
    }, CONNECTION_TIMEOUT_MS);

    try {
      // LiveKit signal endpoint
      const wsUrl = livekitUrl.replace(/^http/, 'ws') + '/rtc';
      
      const ws = new WS(wsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'load-test/1.0',
        },
        handshakeTimeout: 5000,
      });

      const onOpen = () => {
        clearTimeout(timeout);
        ws.removeListener('error', onError);
        resolve({ ok: true, latency: performance.now() - opStart, ws });
      };

      const onError = (err) => {
        clearTimeout(timeout);
        ws.removeListener('open', onOpen);
        resolve({ ok: false, latency: performance.now() - opStart, ws: null, error: err.message });
      };

      ws.once('open', onOpen);
      ws.once('error', onError);
    } catch (e) {
      clearTimeout(timeout);
      resolve({ ok: false, latency: performance.now() - opStart, ws: null, error: e.message });
    }
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  LIVEKIT PARTICIPANT CONNECTION STRESS TEST                     ║');
  console.log('║  Real WebSocket signal connections to the LiveKit SFU          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const { RoomServiceClient } = await import('livekit-server-sdk');
  const env = loadEnv();
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  const livekitUrl = env.LIVEKIT_API_URL || env.NEXT_PUBLIC_LIVEKIT_URL;

  console.log(`▸ LiveKit URL: ${livekitUrl}`);
  const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

  // Verify
  const existing = await svc.listRooms();
  console.log(`✓ Connected. ${existing.length} existing room(s)\n`);

  // Create test room
  const roomName = `stress_participants_${Date.now()}`;
  console.log(`▸ Creating room: ${roomName}`);
  await svc.createRoom({ name: roomName, emptyTimeout: 600, maxParticipants: 500 });
  console.log('✓ Room created\n');

  const results = [];

  for (const targetCount of SCALES) {
    process.stdout.write(`▸ Connecting ${targetCount} participants ... `);
    const startTime = performance.now();
    const latencies = [];
    let connected = 0;
    let failed = 0;
    const sockets = [];

    // Generate tokens and connect all concurrently
    const connections = [];
    for (let i = 0; i < targetCount; i++) {
      const identity = `stress_${i}_${Date.now()}`;
      const token = generateToken(apiKey, apiSecret, roomName, identity, `User ${i}`);
      connections.push(connectParticipant(livekitUrl, token, identity));
    }

    const results_batch = await Promise.all(connections);
    const connectTime = performance.now() - startTime;

    for (const r of results_batch) {
      if (r.ok) {
        connected++;
        sockets.push(r.ws);
      } else {
        failed++;
      }
      latencies.push(r.latency);
    }

    // Check server-side
    let serverCount = 0;
    try {
      const participants = await svc.listParticipants(roomName);
      serverCount = participants.length;
    } catch {}

    // Hold connections
    await new Promise(r => setTimeout(r, HOLD_TIME_MS));

    // Disconnect all
    for (const ws of sockets) {
      try { ws.close(); } catch {}
    }
    await new Promise(r => setTimeout(r, 500));

    latencies.sort((a, b) => a - b);

    const result = {
      target: targetCount,
      connected,
      failed,
      serverCount,
      connectTime,
      rate: connected / (connectTime / 1000),
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
    };
    results.push(result);

    const s = failed === 0 ? '✓' : '⚠';
    console.log(`${s} ${connected}/${targetCount} (server: ${serverCount}) | ${result.rate.toFixed(1)}/s | p99=${formatMs(result.p99)}`);
    if (failed > 0) console.log(`  ⚠  ${failed} failures`);

    await new Promise(r => setTimeout(r, 2000));
  }

  // Cleanup
  console.log(`\n▸ Deleting room ${roomName} ...`);
  try { await svc.deleteRoom(roomName); } catch {}
  console.log('✓ Cleaned up\n');

  // Summary
  console.log('┌──────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                          PARTICIPANT CONNECTION RESULTS                                     │');
  console.log('└──────────────────────────────────────────────────────────────────────────────────────────────┘');
  console.log('Target │Connected│Failed│Server│Time    │Conn/s │p50     │p95     │p99');
  console.log('───────┼─────────┼──────┼──────┼────────┼───────┼───────┼───────┼────────');
  for (const r of results) {
    console.log(
      String(r.target).padEnd(7) + '│' +
      String(r.connected).padEnd(9) + '│' +
      String(r.failed || '—').padEnd(6) + '│' +
      String(r.serverCount).padEnd(6) + '│' +
      formatMs(r.connectTime).padEnd(8) + '│' +
      (r.rate.toFixed(1) + '/s').padEnd(7) + '│' +
      formatMs(r.p50).padEnd(8) + '│' +
      formatMs(r.p95).padEnd(8) + '│' +
      formatMs(r.p99)
    );
  }
  console.log('───────┴─────────┴──────┴──────┴────────┴───────┴───────┴───────┴────────');

  const maxOk = results.reduce((max, r) => r.connected > max.connected ? r : max, results[0]);
  const firstFail = results.find(r => r.failed > 0);
  console.log(`\n✦ Max connected: ${maxOk.connected} participants`);
  if (firstFail) console.log(`⚠ Breakdown at: ${firstFail.target} target (${firstFail.failed} failed)`);
  else console.log(`✓ No failures at any tested level`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
