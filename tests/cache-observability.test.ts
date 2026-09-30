import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { cacheRoutes } from '../cache-service/src/routes/cache.routes.js';
import { registerCacheObservability } from '../cache-service/src/observability/http.js';
import { CACHE_HITS, CACHE_MISSES } from '../cache-service/src/observability/metrics.js';
import { attributeSets, installInMemoryMetrics, sumCounter } from './helpers/in-memory-metrics.js';

const KEY = 'pelicula:observabilidad';

type SetCall = {
    key: string;
    ex: number | undefined;
};

function createRedis() {
    const store = new Map<string, string>();
    const setCalls: SetCall[] = [];
    const redis = {
        setCalls,
        async set(key: string, value: string, options?: { EX?: number }) {
            store.set(key, value);
            setCalls.push({ key, ex: options?.EX });
        },
        async get(key: string) {
            return store.get(key) ?? null;
        },
        async del(key: string) {
            return store.delete(key) ? 1 : 0;
        },
    };
    return redis;
}

let app: FastifyInstance;
let redis: ReturnType<typeof createRedis>;
let collect: () => Promise<import('@opentelemetry/sdk-metrics').ResourceMetrics[]>;

beforeAll(async () => {
    const installed = installInMemoryMetrics();
    collect = installed.collect;
    redis = createRedis();
    app = Fastify();
    registerCacheObservability(app);
    await cacheRoutes(app, redis as never);
});

afterAll(async () => {
    await app.close();
});

describe('Cache HIT, MISS, TTL e invalidación', () => {
    it('incrementa MISS y HIT, conserva x-cache y no usa la clave como atributo', async () => {
        const miss = await app.inject({
            method: 'GET',
            url: `/cache/${encodeURIComponent(KEY)}`,
        });
        expect(miss.statusCode).toBe(404);
        expect(miss.headers['x-cache']).toBe('MISS');
        expect(miss.json()).toMatchObject({ cache: 'MISS', key: KEY });

        const saved = await app.inject({
            method: 'POST',
            url: '/cache',
            payload: {
                key: KEY,
                value: { id: 7, nombre: 'cache' },
                ttl: 45,
            },
        });
        expect(saved.statusCode).toBe(201);
        expect(saved.json()).toMatchObject({
            mensaje: 'Dato guardado en cache',
            key: KEY,
            ttl: 45,
        });

        const hit = await app.inject({
            method: 'GET',
            url: `/cache/${encodeURIComponent(KEY)}`,
        });
        expect(hit.statusCode).toBe(200);
        expect(hit.headers['x-cache']).toBe('HIT');
        expect(hit.json()).toMatchObject({
            cache: 'HIT',
            key: KEY,
            value: { id: 7, nombre: 'cache' },
        });

        const collected = await collect();
        expect(sumCounter(collected, CACHE_MISSES)).toBe(1);
        expect(sumCounter(collected, CACHE_HITS)).toBe(1);
        const serialized = JSON.stringify(attributeSets(collected, CACHE_HITS)
            .concat(attributeSets(collected, CACHE_MISSES)));
        expect(serialized).not.toContain(KEY);
    });

    it('sigue guardando con el TTL recibido y con el TTL por defecto', async () => {
        await app.inject({
            method: 'POST',
            url: '/cache',
            payload: {
                key: 'ttl-explicito',
                value: { ok: true },
                ttl: 15,
            },
        });
        await app.inject({
            method: 'POST',
            url: '/cache',
            payload: {
                key: 'ttl-defecto',
                value: { ok: true },
            },
        });

        expect(redis.setCalls).toContainEqual({ key: 'ttl-explicito', ex: 15 });
        expect(redis.setCalls).toContainEqual({ key: 'ttl-defecto', ex: 60 });
    });

    it('sigue invalidando con DELETE', async () => {
        const missing = await app.inject({
            method: 'DELETE',
            url: '/cache/clave-ausente',
        });
        expect(missing.statusCode).toBe(404);
        expect(missing.json()).toMatchObject({
            key: 'clave-ausente',
            mensaje: 'Dato no encontrado en cache',
        });

        const removed = await app.inject({
            method: 'DELETE',
            url: `/cache/${encodeURIComponent(KEY)}`,
        });
        expect(removed.statusCode).toBe(200);
        expect(removed.json()).toMatchObject({
            key: KEY,
            mensaje: 'Dato eliminado de cache',
        });

        const after = await app.inject({
            method: 'GET',
            url: `/cache/${encodeURIComponent(KEY)}`,
        });
        expect(after.statusCode).toBe(404);
        expect(after.headers['x-cache']).toBe('MISS');

        const collected = await collect();
        expect(sumCounter(collected, CACHE_HITS)).toBe(1);
        expect(sumCounter(collected, CACHE_MISSES)).toBe(2);
    });
});
