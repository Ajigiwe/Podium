#!/usr/bin/env node
/**
 * Podium LMS — LiveKit Health Check Script
 *
 * Standalone health check that can be run directly on the VPS.
 * Shows real-time room count, participant count, and server metrics.
 *
 * Usage: node health-check.mjs
 *        node health-check.mjs --json    # JSON output
 *        node health-check.mjs --watch   # Refresh every 5s
 */

import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import os from 'node:os';

// ─── Config ──────────────────────────────────────────────────────────────────
const WATCH_MODE = process.argv.includes('--watch');
const JSON_MODE = process.argv.includes('--json');
const REFRESH_INTERVAL_MS = 5000;

// Capacity thresholds (from your optimized config)
const CONFIG = {
    maxParticipantsPerRoom: 350,
    maxConcurrentRooms: 200,
    warningThreshold: 0.7,   // 70%
    criticalThreshold: 0.9,  // 90%
};

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

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function getHealthStatus(warnings) {
    if (warnings.some(w => w.includes('CRITICAL'))) return '🔴 UNHEALTHY';
    if (warnings.length > 0) return '🟡 DEGRADED';
    return '🟢 HEALTHY';
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function runHealthCheck() {
    const startTime = performance.now();
    
    // Load environment
    const env = loadEnv();
    const apiKey = env.LIVEKIT_API_KEY;
    const apiSecret = env.LIVEKIT_API_SECRET;
    const livekitUrl = env.LIVEKIT_API_URL || env.NEXT_PUBLIC_LIVEKIT_URL;
    
    if (!apiKey || !apiSecret || !livekitUrl) {
        console.error('❌ Missing LiveKit credentials in .env.local');
        process.exit(1);
    }
    
    // Import LiveKit SDK
    const { RoomServiceClient } = await import('livekit-server-sdk');
    
    // Get server metrics
    const memUsage = process.memoryUsage();
    const loadAvg = os.loadavg();
    const cpuCores = os.cpus().length;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Connect to LiveKit
    let livekitConnected = false;
    let rooms = [];
    let totalParticipants = 0;
    let warnings = [];
    
    try {
        const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
        rooms = await svc.listRooms();
        livekitConnected = true;
        
        for (const room of rooms) {
            totalParticipants += room.numParticipants;
        }
    } catch (error) {
        warnings.push(`CRITICAL: LiveKit connection failed - ${error.message}`);
    }
    
    const activeRooms = rooms.filter(r => r.numParticipants > 0);
    const emptyRooms = rooms.filter(r => r.numParticipants === 0);
    
    // Check thresholds
    if (totalParticipants > CONFIG.maxParticipantsPerRoom * CONFIG.criticalThreshold) {
        warnings.push(`CRITICAL: Total participants (${totalParticipants}) at ${((totalParticipants / CONFIG.maxParticipantsPerRoom) * 100).toFixed(1)}% capacity`);
    } else if (totalParticipants > CONFIG.maxParticipantsPerRoom * CONFIG.warningThreshold) {
        warnings.push(`WARNING: Total participants (${totalParticipants}) at ${((totalParticipants / CONFIG.maxParticipantsPerRoom) * 100).toFixed(1)}% capacity`);
    }
    
    if (rooms.length > CONFIG.maxConcurrentRooms * CONFIG.warningThreshold) {
        warnings.push(`WARNING: Room count (${rooms.length}) approaching limit`);
    }
    
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (heapUsedPercent > 90) {
        warnings.push(`CRITICAL: Heap memory at ${heapUsedPercent.toFixed(1)}%`);
    } else if (heapUsedPercent > 70) {
        warnings.push(`WARNING: Heap memory at ${heapUsedPercent.toFixed(1)}%`);
    }
    
    if (loadAvg[0] > cpuCores * 0.9) {
        warnings.push(`CRITICAL: CPU load ${loadAvg[0].toFixed(2)} exceeds ${cpuCores * 0.9}`);
    } else if (loadAvg[0] > cpuCores * 0.7) {
        warnings.push(`WARNING: CPU load ${loadAvg[0].toFixed(2)} is high`);
    }
    
    const responseTime = performance.now() - startTime;
    
    // JSON output
    if (JSON_MODE) {
        const result = {
            status: warnings.some(w => w.includes('CRITICAL')) ? 'unhealthy' : warnings.length > 0 ? 'degraded' : 'healthy',
            timestamp: new Date().toISOString(),
            responseTime: responseTime.toFixed(2) + 'ms',
            livekit: {
                connected: livekitConnected,
                url: livekitUrl,
                rooms: { total: rooms.length, active: activeRooms.length, empty: emptyRooms.length },
                participants: { total: totalParticipants },
            },
            server: {
                memory: { used: formatBytes(usedMem), total: formatBytes(totalMem), heapUsed: formatBytes(memUsage.heapUsed), heapPercent: heapUsedPercent.toFixed(1) + '%' },
                cpu: { load1: loadAvg[0].toFixed(2), load5: loadAvg[1].toFixed(2), load15: loadAvg[2].toFixed(2), cores: cpuCores },
            },
            config: CONFIG,
            warnings,
        };
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    
    // Pretty output
    if (!WATCH_MODE) {
        console.clear();
    }
    
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║              PODIUM LMS — LIVEKIT HEALTH CHECK                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`  ${getHealthStatus(warnings)}  ${new Date().toLocaleString()}`);
    console.log();
    
    console.log('━━━ LIVEKIT SERVER ━━━');
    console.log(`  URL:            ${livekitUrl}`);
    console.log(`  Connection:     ${livekitConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log();
    
    console.log('━━━ ROOMS ━━━');
    console.log(`  Total:          ${rooms.length} / ${CONFIG.maxConcurrentRooms} max`);
    console.log(`  Active:         ${activeRooms.length}`);
    console.log(`  Empty:          ${emptyRooms.length}`);
    console.log();
    
    console.log('━━━ PARTICIPANTS ━━━');
    console.log(`  Total:          ${totalParticipants} / ${CONFIG.maxParticipantsPerRoom} max`);
    console.log(`  Utilization:    ${((totalParticipants / CONFIG.maxParticipantsPerRoom) * 100).toFixed(1)}%`);
    console.log();
    
    console.log('━━━ SERVER RESOURCES ━━━');
    console.log(`  CPU Load:       ${loadAvg[0].toFixed(2)} / ${cpuCores} cores`);
    console.log(`  Memory:         ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${((usedMem / totalMem) * 100).toFixed(1)}%)`);
    console.log(`  Node.js Heap:   ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)} (${heapUsedPercent.toFixed(1)}%)`);
    console.log(`  RSS:            ${formatBytes(memUsage.rss)}`);
    console.log();
    
    console.log('━━━ ROOM DETAILS ━━━');
    if (rooms.length === 0) {
        console.log('  No active rooms');
    } else {
        for (const room of rooms.slice(0, 10)) { // Show max 10
            const bar = '█'.repeat(Math.min(room.numParticipants, 20));
            const capacity = room.numParticipants > 0 
                ? `${room.numParticipants}/${CONFIG.maxParticipantsPerRoom}` 
                : 'empty';
            console.log(`  ${room.name.padEnd(30)} ${capacity.padEnd(12)} ${bar}`);
        }
        if (rooms.length > 10) {
            console.log(`  ... and ${rooms.length - 10} more rooms`);
        }
    }
    console.log();
    
    if (warnings.length > 0) {
        console.log('━━━ WARNINGS ━━━');
        for (const warning of warnings) {
            console.log(`  ⚠️  ${warning}`);
        }
        console.log();
    }
    
    console.log(`━━━ RESPONSE TIME: ${responseTime.toFixed(2)}ms ━━━`);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
if (WATCH_MODE) {
    console.log('Watching... (Ctrl+C to stop)');
    setInterval(runHealthCheck, REFRESH_INTERVAL_MS);
    runHealthCheck();
} else {
    runHealthCheck();
}
