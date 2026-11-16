import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import * as database from '../src/database.js';

describe('Probes Kubernetes', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('liveness /healthz no depende de la base de datos', async () => {
        const app = buildApp();
        try {
            const respuesta = await app.inject({ method: 'GET', url: '/healthz' });
            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json().probe).toBe('liveness');
        } finally {
            await app.close();
        }
    });

    it('readiness /readyz responde 503 si MySQL no está disponible', async () => {
        vi.spyOn(database.db, 'query').mockRejectedValue(new Error('db down'));
        const app = buildApp();
        try {
            const respuesta = await app.inject({ method: 'GET', url: '/readyz' });
            expect(respuesta.statusCode).toBe(503);
            expect(respuesta.json().status).toBe('not_ready');
        } finally {
            await app.close();
        }
    });

    it('readiness /readyz responde 200 si MySQL responde', async () => {
        vi.spyOn(database.db, 'query').mockResolvedValue([[{ ok: 1 }]] as never);
        const app = buildApp();
        try {
            const respuesta = await app.inject({ method: 'GET', url: '/readyz' });
            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json().status).toBe('ready');
        } finally {
            await app.close();
        }
    });
});
