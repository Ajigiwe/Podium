import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';

interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    livekit: {
        connected: boolean;
        url: string;
        rooms: {
            total: number;
            active: number;
            empty: number;
            details: Array<{
                name: string;
                participants: number;
                maxSize: number;
                createdAt: string;
            }>;
        };
        participants: {
            total: number;
            publishing: number;
            subscribing: number;
        };
    };
    server: {
        memory: {
            heapUsed: number;
            heapTotal: number;
            external: number;
            rss: number;
            heapUsedPercent: number;
        };
        cpu: {
            loadAvg: number[];
            cores: number;
        };
        process: {
            pid: number;
            uptime: number;
            nodeVersion: string;
        };
    };
    config: {
        maxParticipantsPerRoom: number;
        maxConcurrentRooms: number;
        warningThreshold: number;
        criticalThreshold: number;
    };
    warnings: string[];
}

// Cache to avoid hammering the server on rapid requests
let cachedResult: { data: HealthResponse; timestamp: number } | null = null;
const CACHE_TTL_MS = 5000; // 5 seconds

export async function GET(request: NextRequest) {
    const startTime = performance.now();
    const warnings: string[] = [];

    // Check cache
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cachedResult.data, {
            headers: {
                'Cache-Control': 'public, max-age=5, stale-while-revalidate=5',
                'X-Cache': 'HIT',
                'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
            },
        });
    }

    // Check environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
        return NextResponse.json(
            {
                status: 'unhealthy',
                error: 'LiveKit credentials not configured',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }

    // Get server metrics
    const memUsage = process.memoryUsage();
    const os = await import('os');
    const loadAvg = os.loadavg();
    const cpuCores = os.cpus().length;

    // Connect to LiveKit and get room data
    // Try local URL first (Docker host networking), then external
    let livekitConnected = false;
    let rooms: any[] = [];
    let totalParticipants = 0;
    let connectedUrl = livekitUrl;

    const urlsToTry = [
        'http://localhost:7880',
        'http://127.0.0.1:7880',
        livekitUrl,
    ];

    for (const url of urlsToTry) {
        try {
            const svc = new RoomServiceClient(url, apiKey, apiSecret);
            rooms = await svc.listRooms();
            livekitConnected = true;
            connectedUrl = url;
            for (const room of rooms) {
                totalParticipants += room.numParticipants;
            }
            break;
        } catch {
            continue;
        }
    }

    if (!livekitConnected) {
        warnings.push('LiveKit server unreachable on all URLs');
    }

    // Analyze room state
    const activeRooms = rooms.filter((r) => r.numParticipants > 0);
    const emptyRooms = rooms.filter((r) => r.numParticipants === 0);

    // Generate warnings based on thresholds
    const config = {
        maxParticipantsPerRoom: 350, // Your optimized config
        maxConcurrentRooms: 200,
        warningThreshold: 0.7, // 70%
        criticalThreshold: 0.9, // 90%
    };

    if (totalParticipants > config.maxParticipantsPerRoom * config.criticalThreshold) {
        warnings.push(
            `Critical: Total participants (${totalParticipants}) exceeds ${config.criticalThreshold * 100}% of capacity`
        );
    } else if (totalParticipants > config.maxParticipantsPerRoom * config.warningThreshold) {
        warnings.push(
            `Warning: Total participants (${totalParticipants}) exceeds ${config.warningThreshold * 100}% of capacity`
        );
    }

    if (rooms.length > config.maxConcurrentRooms * config.warningThreshold) {
        warnings.push(
            `Warning: Room count (${rooms.length}) approaching limit`
        );
    }

    // Check memory usage - Node.js heap is naturally high, only warn at 90%
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (heapUsedPercent > 95) {
        warnings.push(`Critical: Heap memory at ${heapUsedPercent.toFixed(1)}%`);
    }

    // Check CPU load - only warn at very high load
    if (loadAvg[0] > cpuCores * 0.95) {
        warnings.push(`Critical: CPU load ${loadAvg[0].toFixed(2)} exceeds ${cpuCores * 0.95}`);
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!livekitConnected) {
        status = 'degraded'; // Not unhealthy - just can't reach stats
    } else if (warnings.some((w) => w.startsWith('Critical'))) {
        status = 'unhealthy';
    } else if (warnings.length > 0) {
        status = 'degraded';
    }

    const responseTime = performance.now() - startTime;

    const healthData: HealthResponse = {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        livekit: {
            connected: livekitConnected,
            url: connectedUrl,
            rooms: {
                total: rooms.length,
                active: activeRooms.length,
                empty: emptyRooms.length,
                details: rooms.map((room) => ({
                    name: room.name,
                    participants: room.numParticipants,
                    maxSize: config.maxParticipantsPerRoom,
                    createdAt: room.createdAt
                        ? new Date(room.createdAt * 1000).toISOString()
                        : 'unknown',
                })),
            },
            participants: {
                total: totalParticipants,
                publishing: 0, // Would need to list participants per room
                subscribing: 0,
            },
        },
        server: {
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                heapUsedPercent,
            },
            cpu: {
                loadAvg,
                cores: cpuCores,
            },
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                nodeVersion: process.version,
            },
        },
        config,
        warnings,
    };

    // Cache the result
    cachedResult = { data: healthData, timestamp: Date.now() };

    return NextResponse.json(healthData, {
        headers: {
            'Cache-Control': 'public, max-age=5, stale-while-revalidate=5',
            'X-Cache': 'MISS',
            'X-Response-Time': `${responseTime.toFixed(2)}ms`,
        },
    });
}
