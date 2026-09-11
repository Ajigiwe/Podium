#!/usr/bin/env node
/**
 * Podium LMS — Token API Load Test
 * 
 * Tests how many concurrent LiveKit token generations the system can handle.
 * Two modes:
 *   1. CPU-only: JWT signing throughput (no server needed)
 *   2. HTTP: Full API endpoint throughput (requires `npm run dev`)
 *
 * Usage:
 *   node load-test-token-api.mjs              # CPU-only test (default)
 *   node load-test-token-api.mjs --http       # HTTP endpoint test (needs dev server on :3000)
 *   node load-test-token-api.mjs --http --url http://localhost:3000
 */

import { performance } from 'node:perf_hooks';
import crypto from 'node:crypto';

// ─── Config ──────────────────────────────────────────────────────────────────
const USE_HTTP = process.argv.includes('--http');
const BASE_URL = (() => {
  const urlIdx = process.argv.indexOf('--url');
  return urlIdx !== -1 ? process.argv[urlIdx + 1] : 'http://localhost:3000';
})();

// Escalating concurrency levels
const CONCURRENCY_LEVELS = [10, 25, 50, 100, 200, 350, 500];
const DURATION_MS = 10_000;       // 10 seconds per level
const RAMP_UP_MS = 2_000;         // 2 second ramp-up
const COOLDOWN_MS = 1_000;        // 1 second between levels

// ─── Helpers ─────────────────────────────────────────────────────────────────

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  return `${ms.toFixed(2)}ms`;
}

function formatRate(n, durationSec) {
  return (n / durationSec).toFixed(1);
}

function printTable(rows) {
  const header = rows[0];
  const colWidths = header.map((_, i) =>
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

// ─── CPU-only test (JWT signing) ─────────────────────────────────────────────
async function runCpuTest() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  LIVEKIT TOKEN — CPU Signing Throughput Test               ║');
  console.log('║  (Simulates JWT generation without network overhead)      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // We'll simulate JWT signing with HMAC-SHA256 (same as LiveKit uses)
  const apiKey = 'test_key_' + crypto.randomBytes(8).toString('hex');
  const apiSecret = 'test_secret_' + crypto.randomBytes(16).toString('hex');

  const results = [];

  for (const concurrency of CONCURRENCY_LEVELS) {
    process.stdout.write(`\n▸ Testing ${concurrency} concurrent signers for ${(DURATION_MS / 1000).toFixed(0)}s ... `);

    let totalOps = 0;
    let errors = 0;
    const latencies = [];
    const startTime = performance.now();
    const deadline = startTime + DURATION_MS;
    let activeWorkers = 0;
    let resolveAll;
    const allDone = new Promise(r => resolveAll = r);

    function spawnWorker() {
      if (activeWorkers >= concurrency) return;
      activeWorkers++;

      const workerStart = performance.now();
      const workerDeadline = startTime + DURATION_MS;

      async function signLoop() {
        while (performance.now() < workerDeadline) {
          const opStart = performance.now();
          try {
            // Simulate what livekit-server-sdk does: HMAC-SHA256 header + payload
            const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
            const payload = Buffer.from(JSON.stringify({
              iss: apiKey,
              sub: `user_${totalOps}`,
              name: `Test User ${totalOps}`,
              metadata: JSON.stringify({ role: 'student' }),
              video: { room: `podium_test_${totalOps % 50}`, roomJoin: true, canSubscribe: true },
              nbf: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 86400,
            })).toString('base64url');
            crypto.createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest('base64url');
            totalOps++;
          } catch (e) {
            errors++;
          }
          const opEnd = performance.now();
          latencies.push(opEnd - opStart);
        }
        activeWorkers--;
        if (activeWorkers === 0) resolveAll();
      }
      signLoop();
    }

    for (let i = 0; i < concurrency; i++) spawnWorker();
    await allDone;

    const elapsed = (performance.now() - startTime) / 1000;
    latencies.sort((a, b) => a - b);

    const result = {
      concurrency,
      totalOps,
      errors,
      elapsed,
      opsPerSec: totalOps / elapsed,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies[latencies.length - 1] || 0,
    };
    results.push(result);

    console.log(`${result.opsPerSec.toFixed(0)} ops/s | p50=${formatMs(result.p50)} p95=${formatMs(result.p95)} p99=${formatMs(result.p99)}`);

    // Check if we're CPU-saturated (p99 is much higher than p50)
    if (result.p99 > result.p50 * 10 && concurrency > 50) {
      console.log(`  ⚠  Latency spike detected — likely CPU-saturated at ${concurrency} concurrent signers`);
    }

    await new Promise(r => setTimeout(r, COOLDOWN_MS));
  }

  // Print summary
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                              CPU SIGNING RESULTS                                   │');
  console.log('└─────────────────────────────────────────────────────────────────────────────────────┘');
  printTable([
    ['Concurrency', 'Total Ops', 'Ops/sec', 'p50', 'p95', 'p99', 'Max', 'Errors'],
    ...results.map(r => [
      r.concurrency,
      r.totalOps,
      formatRate(r.totalOps, r.elapsed) + '/s',
      formatMs(r.p50),
      formatMs(r.p95),
      formatMs(r.p99),
      formatMs(r.max),
      r.errors || '—',
    ]),
  ]);

  // Find the sweet spot
  const optimal = results.reduce((best, r) => {
    if (r.errors === 0 && r.p99 < 50 && r.opsPerSec > best.opsPerSec) return r;
    return best;
  }, results[0]);

  console.log(`\n✦ Optimal concurrency: ${optimal.concurrency} signers → ${optimal.opsPerSec.toFixed(0)} tokens/sec`);
  console.log(`  This means ~${Math.floor(optimal.opsPerSec * 60)} tokens/min or ~${Math.floor(optimal.opsPerSec * 3600)} tokens/hour\n`);

  return results;
}

// ─── HTTP endpoint test ──────────────────────────────────────────────────────
async function runHttpTest() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  LIVEKIT TOKEN — HTTP Endpoint Throughput Test              ║');
  console.log(`║  Target: ${BASE_URL}/api/livekit/token${' '.repeat(Math.max(0, 33 - BASE_URL.length))}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // First, check if server is reachable
  try {
    const probe = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    console.log(`✓ Server reachable (HTTP ${probe.status})\n`);
  } catch (e) {
    console.error(`✗ Cannot reach ${BASE_URL} — ${e.message}`);
    console.error('  Start the dev server with: npm run dev\n');
    process.exit(1);
  }

  const results = [];

  for (const concurrency of CONCURRENCY_LEVELS) {
    process.stdout.write(`▸ ${concurrency} concurrent requests for ${(DURATION_MS / 1000).toFixed(0)}s ... `);

    let totalOps = 0;
    let successes = 0;
    let failures = 0;
    let timeouts = 0;
    let httpErrors = 0;
    const latencies = [];
    const startTime = performance.now();
    let activeWorkers = 0;
    let resolveAll;
    const allDone = new Promise(r => resolveAll = r);

    async function worker() {
      if (activeWorkers >= concurrency) return;
      activeWorkers++;

      while (performance.now() - startTime < DURATION_MS) {
        const opStart = performance.now();
        try {
          const res = await fetch(`${BASE_URL}/api/livekit/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomName: `podium_loadtest_${totalOps % 50}`,
              participantName: `LoadTest User ${totalOps}`,
              participantId: `loadtest_${totalOps}_${Date.now()}`,
              role: totalOps % 3 === 0 ? 'lecturer' : 'student',
              userId: `uid_${totalOps}`,
            }),
            signal: AbortSignal.timeout(10_000),
          });
          const status = res.status;
          if (status === 200) successes++;
          else httpErrors++;
        } catch (e) {
          if (e.name === 'AbortError' || e.name === 'TimeoutError') timeouts++;
          else failures++;
        }
        totalOps++;
        latencies.push(performance.now() - opStart);
      }
      activeWorkers--;
      if (activeWorkers === 0) resolveAll();
    }

    for (let i = 0; i < concurrency; i++) worker();
    await allDone;

    const elapsed = (performance.now() - startTime) / 1000;
    latencies.sort((a, b) => a - b);

    const result = {
      concurrency,
      totalOps,
      successes,
      errors: failures + httpErrors + timeouts,
      httpErrors,
      timeouts,
      elapsed,
      opsPerSec: totalOps / elapsed,
      successRate: ((successes / totalOps) * 100).toFixed(1) + '%',
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies[latencies.length - 1] || 0,
    };
    results.push(result);

    const status = result.errors === 0 ? '✓' : '⚠';
    console.log(`${status} ${result.opsPerSec.toFixed(1)} req/s | ${result.successRate} ok | p99=${formatMs(result.p99)}`);

    if (result.timeouts > 0) console.log(`  ⚠  ${result.timeouts} timeouts`);
    if (result.httpErrors > 0) console.log(`  ⚠  ${result.httpErrors} HTTP errors (4xx/5xx)`);

    await new Promise(r => setTimeout(r, COOLDOWN_MS));
  }

  // Print summary
  console.log('\n┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                                    HTTP ENDPOINT RESULTS                                           │');
  console.log('└──────────────────────────────────────────────────────────────────────────────────────────────────────┘');
  printTable([
    ['Concurrent', 'Requests', 'Req/sec', 'Success', 'p50', 'p95', 'p99', 'Max', 'Errors'],
    ...results.map(r => [
      r.concurrency,
      r.totalOps,
      r.opsPerSec.toFixed(1) + '/s',
      r.successRate,
      formatMs(r.p50),
      formatMs(r.p95),
      formatMs(r.p99),
      formatMs(r.max),
      r.errors ? r.errors : '—',
    ]),
  ]);

  // Find breakdown point (where error rate > 5% or p99 > 5000ms)
  const breakdown = results.find(r => {
    const errorRate = r.errors / r.totalOps;
    return errorRate > 0.05 || r.p99 > 5000;
  });
  const sweetSpot = results.reduce((best, r) => {
    if (r.errors === 0 && r.p99 < 2000 && r.opsPerSec > best.opsPerSec) return r;
    return best;
  }, results[0]);

  console.log(`\n✦ Sweet spot: ${sweetSpot.concurrency} concurrent → ${sweetSpot.opsPerSec.toFixed(1)} req/s`);
  if (breakdown) {
    console.log(`⚠ Breakdown at: ${breakdown.concurrency} concurrent (${breakdown.errors} errors, p99=${formatMs(breakdown.p99)})`);
  } else {
    console.log(`✓ No breakdown observed — system handled all tested levels`);
  }

  // Project session capacity
  // Each "session" = 1 token request (join) + periodic reconnection
  // Assume each user generates ~2 tokens/hr (join + reconnect)
  const tokensPerUserPerHour = 2;
  const safeOps = sweetSpot.opsPerSec;
  const maxConcurrentUsers = Math.floor((safeOps * 3600) / tokensPerUserPerHour);
  console.log(`\n📊 Estimated capacity at sweet spot:`);
  console.log(`   ~${maxConcurrentUsers.toLocaleString()} concurrent users (assuming ${tokensPerUserPerHour} token requests/hr each)`);
  console.log(`   ~${Math.floor(maxConcurrentUsers / 30)} concurrent classrooms of 30 students`);
  console.log(`   ~${Math.floor(maxConcurrentUsers / 100)} concurrent large rooms of 100 students\n`);

  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          PODIUM LMS — Session Load Test                     ║');
console.log(`║  Mode: ${USE_HTTP ? 'HTTP Endpoint' : 'CPU Signing Only'}${' '.repeat(USE_HTTP ? 36 : 33)}║`);
console.log('║  Duration: 10s per concurrency level                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const startTime = performance.now();

let cpuResults;
if (USE_HTTP) {
  cpuResults = await runCpuTest();
}

const httpResults = USE_HTTP ? await runHttpTest() : await runCpuTest();

const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
console.log(`\n⏱  Total test time: ${totalTime}s`);
console.log('══════════════════════════════════════════════════════════════════════════════════════════════════════════');
