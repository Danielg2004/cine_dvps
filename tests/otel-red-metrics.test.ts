import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
    HTTP_SERVER_ERRORS,
    HTTP_SERVER_REQUEST_DURATION,
    HTTP_SERVER_REQUESTS,
} from '../src/observability/metrics.js';
import { attributeSets, histogramCount, installInMemoryMetrics, sumCounter } from './helpers/in-memory-metrics.js';

let server: http.Server;
let app: FastifyInstance;
let collect: () => Promise<import('@opentelemetry/sdk-metrics').ResourceMetrics[]>;

beforeAll(async () => {
    server = http.createServer((_request, response) => {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ cache: 'MISS' }));
    });

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    process.env.CACHE_URL = `http://127.0.0.1:${port}`;

    const installed = installInMemoryMetrics();
    collect = installed.collect;

    const module = await import('../src/app.js');
    app = module.buildApp();
});

afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

describe('métricas RED de Cine', () => {
    it('mantiene /api/v2/health y usa plantillas de baja cardinalidad', async () => {
        const health = await app.inject({
            method: 'GET',
            url: '/api/v2/health',
        });
        expect(health.statusCode).toBe(200);
        expect(health.json()).toEqual({ version: 'v2', status: 'ok' });

        const missing = await app.inject({
            method: 'GET',
            url: '/api/v2/no-existe',
        });
        expect(missing.statusCode).toBe(404);

        const first = await app.inject({
            method: 'GET',
            url: '/api/v2/peliculas/11',
        });
        const second = await app.inject({
            method: 'GET',
            url: '/api/v2/peliculas/12',
        });
        expect(first.statusCode).toBeGreaterThanOrEqual(500);
        expect(second.statusCode).toBeGreaterThanOrEqual(500);

        const collected = await collect();
        const healthRequests = sumCounter(
            collected,
            HTTP_SERVER_REQUESTS,
            (attributes) => attributes['http.route'] === '/api/v2/health',
        );
        const healthErrors = sumCounter(
            collected,
            HTTP_SERVER_ERRORS,
            (attributes) => attributes['http.route'] === '/api/v2/health',
        );
        const healthDuration = histogramCount(
            collected,
            HTTP_SERVER_REQUEST_DURATION,
            (attributes) => attributes['http.route'] === '/api/v2/health',
        );

        expect(healthRequests).toBe(1);
        expect(healthErrors).toBe(0);
        expect(healthDuration).toBe(1);

        const unmatched = attributeSets(collected, HTTP_SERVER_REQUESTS)
            .filter((attributes) => attributes['http.response.status_code'] === 404);
        expect(unmatched).toEqual([
            expect.objectContaining({
                'http.route': 'unmatched',
                'http.request.method': 'GET',
            }),
        ]);
        expect(JSON.stringify(unmatched)).not.toContain('no-existe');

        const peliculaAttributes = attributeSets(collected, HTTP_SERVER_REQUESTS)
            .filter((attributes) => attributes['http.route'] === '/api/v2/peliculas/:id');
        expect(peliculaAttributes).toHaveLength(1);
        expect(sumCounter(
            collected,
            HTTP_SERVER_REQUESTS,
            (attributes) => attributes['http.route'] === '/api/v2/peliculas/:id',
        )).toBe(2);
        expect(JSON.stringify(peliculaAttributes)).not.toContain('/11');
        expect(JSON.stringify(peliculaAttributes)).not.toContain('/12');

        const peliculaErrors = sumCounter(
            collected,
            HTTP_SERVER_ERRORS,
            (attributes) => attributes['http.route'] === '/api/v2/peliculas/:id',
        );
        expect(peliculaErrors).toBe(2);
    });
});
