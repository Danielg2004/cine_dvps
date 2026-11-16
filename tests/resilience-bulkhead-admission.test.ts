import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppDataSourceV2 } from '../src/config/database-v2.js';
import * as cacheClient from '../src/clients/cache.client.js';
import { experimentalAdmission } from '../src/resilience/admission.js';
import { experimentalBulkhead } from '../src/resilience/bulkhead.js';
import { admissionMaxInflight, bulkheadMaxConcurrent } from '../src/resilience/config.js';
import {
    resetSaturationForTests,
    startSaturation,
    stopSaturation,
} from '../src/chaos/saturation.js';

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
        delete process.env.BULKHEAD_ENTER_TIMEOUT_MS;
    });

    it('alineación: admission nunca supera bulkhead', () => {
        process.env.BULKHEAD_MAX_CONCURRENT = '4';
        process.env.ADMISSION_MAX_INFLIGHT = '99';
        expect(bulkheadMaxConcurrent()).toBe(4);
        expect(admissionMaxInflight()).toBe(4);
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

    it('R1: con capacidad disponible no rechaza', async () => {
        process.env.EXPERIMENT_ROUND = 'r1';
        process.env.ADMISSION_MAX_INFLIGHT = '8';
        process.env.BULKHEAD_MAX_CONCURRENT = '8';
        mockPeliculaOk();
        const app = buildApp();
        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/peliculas/1',
                headers: { 'x-trace-id': 'r1-capacity' },
            });
            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['x-trace-id']).toBe('r1-capacity');
        } finally {
            await app.close();
        }
    });

    it('libera recursos del bulkhead y admission tras la respuesta', async () => {
        process.env.EXPERIMENT_ROUND = 'r1';
        process.env.ADMISSION_MAX_INFLIGHT = '4';
        process.env.BULKHEAD_MAX_CONCURRENT = '4';
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

    it('R0 bajo saturación con cola acotada puede devolver 503 por timeout de cola', async () => {
        process.env.EXPERIMENT_ROUND = 'r0';
        mockPeliculaOk();
        startSaturation({
            holdMs: 300,
            maxInflight: 1,
            durationSec: 10,
            maxQueueWaitMs: 20,
        });

        const app = buildApp();
        try {
            const results = await Promise.all(
                Array.from({ length: 6 }, (_, i) =>
                    app.inject({
                        method: 'GET',
                        url: '/api/v2/peliculas/1',
                        headers: { 'x-trace-id': `sat-${i}` },
                    })
                )
            );
            const codes = results.map((r) => r.statusCode);
            expect(codes).toContain(200);
            expect(codes).toContain(503);
            expect(
                results.some((r) => r.statusCode === 503 && r.json().reason === 'saturation_queue_timeout')
            ).toBe(true);
        } finally {
            stopSaturation('test');
            await app.close();
        }
    });

    it('experimento desactivado: baseline sin resiliencia responde OK', async () => {
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

    it('saturación + R1 recupera tras stop', async () => {
        process.env.EXPERIMENT_ROUND = 'r1';
        process.env.ADMISSION_MAX_INFLIGHT = '8';
        process.env.BULKHEAD_MAX_CONCURRENT = '8';
        mockPeliculaOk();
        startSaturation({
            holdMs: 20,
            maxInflight: 4,
            durationSec: 5,
            maxQueueWaitMs: 100,
        });

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
