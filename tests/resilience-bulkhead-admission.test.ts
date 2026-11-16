import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppDataSourceV2 } from '../src/config/database-v2.js';
import * as cacheClient from '../src/clients/cache.client.js';
import { experimentalAdmission } from '../src/resilience/admission.js';
import { experimentalBulkhead } from '../src/resilience/bulkhead.js';
import { resetSaturationForTests, startSaturation, stopSaturation } from '../src/chaos/saturation.js';

const pelicula = {
    id: 1,
    nombre: 'Resilience',
    duracion: 100,
    genero: 'Drama',
    descripcion: 'test',
};

function mockPeliculaOk(): void {
    vi.spyOn(cacheClient, 'obtenerCache').mockResolvedValue(null);
    vi.spyOn(cacheClient, 'guardarCache').mockResolvedValue(null);
    vi.spyOn(AppDataSourceV2, 'getRepository').mockReturnValue({
        findOneBy: vi.fn().mockResolvedValue(pelicula),
    } as never);
}

describe('Bulkhead y control de admisión', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        experimentalAdmission.reset();
        experimentalBulkhead.reset();
        resetSaturationForTests();
        delete process.env.EXPERIMENT_ROUND;
        delete process.env.RESILIENCE_ENABLED;
        delete process.env.ADMISSION_MAX_INFLIGHT;
        delete process.env.BULKHEAD_MAX_CONCURRENT;
    });

    it('R0: sin resiliencia permite la solicitud experimental', async () => {
        process.env.EXPERIMENT_ROUND = 'r0';
        mockPeliculaOk();
        const app = buildApp();
        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/peliculas/1',
                headers: { 'x-trace-id': 'r0-ok' },
            });
            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['x-experiment-round']).toBe('r0');
        } finally {
            await app.close();
        }
    });

    it('R1: rechaza por admisión cuando inflight supera el límite', async () => {
        process.env.EXPERIMENT_ROUND = 'r1';
        process.env.ADMISSION_MAX_INFLIGHT = '1';
        process.env.BULKHEAD_MAX_CONCURRENT = '1';
        mockPeliculaOk();

        // Ocupar el único cupo de admisión
        expect(experimentalAdmission.tryAdmit().ok).toBe(true);

        const app = buildApp();
        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/peliculas/1',
            });
            expect(respuesta.statusCode).toBe(503);
            expect(respuesta.json().reason).toBe('inflight_limit');
        } finally {
            experimentalAdmission.release();
            await app.close();
        }
    });

    it('baseline con resiliencia desactivada no rechaza', async () => {
        process.env.EXPERIMENT_ROUND = 'baseline';
        process.env.RESILIENCE_ENABLED = 'false';
        mockPeliculaOk();
        const app = buildApp();
        try {
            const respuesta = await app.inject({ method: 'GET', url: '/api/v2/peliculas/1' });
            expect(respuesta.statusCode).toBe(200);
        } finally {
            await app.close();
        }
    });

    it('libera recursos del bulkhead tras la respuesta', async () => {
        process.env.EXPERIMENT_ROUND = 'r1';
        process.env.ADMISSION_MAX_INFLIGHT = '4';
        process.env.BULKHEAD_MAX_CONCURRENT = '2';
        mockPeliculaOk();
        const app = buildApp();
        try {
            const r1 = await app.inject({ method: 'GET', url: '/api/v2/peliculas/1' });
            expect(r1.statusCode).toBe(200);
            expect(experimentalBulkhead.getActive()).toBe(0);
            expect(experimentalAdmission.getInflight()).toBe(0);
        } finally {
            await app.close();
        }
    });

    it('saturación + R1 sigue pudiendo recuperar tras stop', async () => {
        process.env.EXPERIMENT_ROUND = 'r1';
        process.env.ADMISSION_MAX_INFLIGHT = '8';
        mockPeliculaOk();
        startSaturation({ holdMs: 20, maxInflight: 2, durationSec: 5 });

        const app = buildApp();
        try {
            const durante = await app.inject({ method: 'GET', url: '/api/v2/peliculas/1' });
            expect([200, 503]).toContain(durante.statusCode);
            stopSaturation('test');
            const despues = await app.inject({ method: 'GET', url: '/api/v2/peliculas/1' });
            expect(despues.statusCode).toBe(200);
        } finally {
            await app.close();
        }
    });
});
