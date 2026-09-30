import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TRACE = 'azure-otel-func-001';

type Running = {
    child: ChildProcess;
    output: string;
};

async function freePort(): Promise<number> {
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    return port;
}

function start(args: string[], env: NodeJS.ProcessEnv): Running {
    const child = spawn(process.execPath, args, {
        cwd: process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const running: Running = { child, output: '' };
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => { running.output += chunk; });
    child.stderr?.on('data', (chunk: string) => { running.output += chunk; });
    return running;
}

async function waitFor(running: Running, text: string): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < 25_000) {
        if (running.output.includes(text)) return;
        if (running.child.exitCode !== null) {
            throw new Error(running.output.slice(-1500));
        }
        await delay(50);
    }
    throw new Error(running.output.slice(-1500));
}

function stop(running: Running | undefined): void {
    if (running && running.child.exitCode === null) running.child.kill();
}

describe('flujo funcional Cine y Cache', () => {
    let cache: Running | undefined;
    let cine: Running | undefined;
    let cachePort = 0;
    let cinePort = 0;
    let peliculaId = 0;

    beforeAll(async () => {
        cachePort = await freePort();
        cinePort = await freePort();
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            OTEL_LOGS_EXPORTER: 'none',
        };
        delete env.OTEL_EXPORTER_OTLP_ENDPOINT;
        delete env.OTEL_EXPORTER_OTLP_HEADERS;

        cache = start([
            '--import', 'tsx',
            '--import', '@opentelemetry/instrumentation/hook.mjs',
            '--import', './cache-service/src/observability/instrumentation.ts',
            './cache-service/src/server.ts',
        ], {
            ...env,
            PORT: String(cachePort),
            REDIS_URL: 'redis://127.0.0.1:6379',
            OTEL_SERVICE_NAME: 'cache-service',
        });
        await waitFor(cache, 'Cache Service ejecutandose');

        cine = start([
            '--import', 'tsx',
            '--import', '@opentelemetry/instrumentation/hook.mjs',
            '--import', './src/observability/instrumentation.ts',
            './src/server.ts',
        ], {
            ...env,
            PORT: String(cinePort),
            CACHE_URL: `http://127.0.0.1:${cachePort}`,
            OTEL_SERVICE_NAME: 'cine-api',
        });
        await waitFor(cine, 'Servidor iniciado correctamente');
    }, 40_000);

    afterAll(async () => {
        if (peliculaId) {
            await fetch(`http://127.0.0.1:${cinePort}/api/v2/peliculas/${peliculaId}`, {
                method: 'DELETE',
            }).catch(() => undefined);
            await fetch(`http://127.0.0.1:${cachePort}/cache/pelicula:${peliculaId}`, {
                method: 'DELETE',
            }).catch(() => undefined);
        }
        await fetch(`http://127.0.0.1:${cachePort}/cache/ttl-funcional-otel`, {
            method: 'DELETE',
        }).catch(() => undefined);
        stop(cine);
        stop(cache);
    });

    it('recorre MISS, HIT, TTL, DELETE, x-cache y x-trace-id', async () => {
        expect(cine?.output).toContain('"service":"cine-api"');
        expect(cine?.output).toContain('"otlp":"disabled"');

        const created = await fetch(`http://127.0.0.1:${cinePort}/api/v2/peliculas`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-trace-id': TRACE,
            },
            body: JSON.stringify({
                nombre: 'otel-funcional-temporal',
                duracion: 90,
                genero: 'Prueba',
                descripcion: 'registro temporal de observabilidad',
            }),
        });
        const createdBody = await created.json() as { id?: number };
        peliculaId = Number(createdBody.id);
        expect(created.status).toBe(201);
        expect(peliculaId).toBeGreaterThan(0);

        const first = await fetch(`http://127.0.0.1:${cinePort}/api/v2/peliculas/${peliculaId}`, {
            headers: { 'x-trace-id': TRACE },
        });
        const firstBody = await first.json() as { origen?: string; traceId?: string };
        expect(first.status).toBe(200);
        expect(firstBody.origen).toBe('database');
        expect(firstBody.traceId).toBe(TRACE);
        expect(first.headers.get('x-trace-id')).toBe(TRACE);

        const stored = await fetch(`http://127.0.0.1:${cachePort}/cache/pelicula:${peliculaId}`, {
            headers: { 'x-trace-id': TRACE },
        });
        expect(stored.status).toBe(200);
        expect(stored.headers.get('x-cache')).toBe('HIT');
        expect(stored.headers.get('x-trace-id')).toBe(TRACE);

        const second = await fetch(`http://127.0.0.1:${cinePort}/api/v2/peliculas/${peliculaId}`, {
            headers: { 'x-trace-id': TRACE },
        });
        const secondBody = await second.json() as { origen?: string; traceId?: string };
        expect(second.status).toBe(200);
        expect(secondBody.origen).toBe('cache');
        expect(secondBody.traceId).toBe(TRACE);
        expect(second.headers.get('x-trace-id')).toBe(TRACE);

        const removed = await fetch(`http://127.0.0.1:${cachePort}/cache/pelicula:${peliculaId}`, {
            method: 'DELETE',
            headers: { 'x-trace-id': TRACE },
        });
        expect(removed.status).toBe(200);

        const afterDelete = await fetch(`http://127.0.0.1:${cachePort}/cache/pelicula:${peliculaId}`);
        expect(afterDelete.status).toBe(404);
        expect(afterDelete.headers.get('x-cache')).toBe('MISS');

        const ttlSave = await fetch(`http://127.0.0.1:${cachePort}/cache`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                key: 'ttl-funcional-otel',
                value: { ok: true },
                ttl: 1,
            }),
        });
        const ttlHit = await fetch(`http://127.0.0.1:${cachePort}/cache/ttl-funcional-otel`);
        expect(ttlSave.status).toBe(201);
        expect(ttlHit.headers.get('x-cache')).toBe('HIT');
        await delay(1500);
        const ttlMiss = await fetch(`http://127.0.0.1:${cachePort}/cache/ttl-funcional-otel`);
        expect(ttlMiss.status).toBe(404);
        expect(ttlMiss.headers.get('x-cache')).toBe('MISS');

        const health = await fetch(`http://127.0.0.1:${cinePort}/api/v2/health`);
        expect(health.status).toBe(200);
        const salas = await fetch(`http://127.0.0.1:${cinePort}/api/v2/salas`);
        expect(salas.status).toBe(200);
        const reservas = await fetch(`http://127.0.0.1:${cinePort}/api/v2/reservas`);
        expect(reservas.status).toBe(200);
    }, 30_000);
});
