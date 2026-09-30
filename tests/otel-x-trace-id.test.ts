import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

const TRACE = 'trace-funcional-cine-001';

type Captured = {
    method: string | undefined;
    url: string | undefined;
    traceId: string | string[] | undefined;
};

const captured: Captured[] = [];

let server: http.Server;
let app: FastifyInstance;

beforeAll(async () => {
    server = http.createServer((request, response) => {
        captured.push({
            method: request.method,
            url: request.url,
            traceId: request.headers['x-trace-id'],
        });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
            cache: 'HIT',
            key: 'pelicula:1',
            value: { id: 1, nombre: 'desde-cache' },
        }));
    });

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    process.env.CACHE_URL = `http://127.0.0.1:${port}`;

    const module = await import('../src/app.js');
    app = module.buildApp();
});

afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

describe('x-trace-id de Cine', () => {
    it('preserva el valor recibido, lo devuelve en el header y lo envía a Cache', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v2/peliculas/1',
            headers: {
                'x-trace-id': TRACE,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['x-trace-id']).toBe(TRACE);

        const body = response.json() as { origen: string; traceId: string };
        expect(body.origen).toBe('cache');
        expect(body.traceId).toBe(TRACE);

        const forwarded = captured.find((entry) => entry.url === '/cache/pelicula:1');
        expect(forwarded?.traceId).toBe(TRACE);
    });

    it('genera un identificador y lo devuelve en JSON y en el header cuando no llega x-trace-id', async () => {
        const before = captured.length;
        const response = await app.inject({
            method: 'GET',
            url: '/api/v2/peliculas/1',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { traceId: string };
        expect(typeof body.traceId).toBe('string');
        expect(body.traceId.length).toBeGreaterThan(0);
        expect(response.headers['x-trace-id']).toBe(body.traceId);
        expect(body.traceId).not.toBe(TRACE);

        const forwarded = captured.slice(before).find((entry) => entry.url === '/cache/pelicula:1');
        expect(forwarded?.traceId).toBe(body.traceId);
    });
});
