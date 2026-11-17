import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { resetSaturationForTests } from '../src/chaos/saturation.js';

const TOKEN = 'token-caos-pruebas-seguimiento4';

describe('Interruptor de saturación controlada', () => {
    afterEach(() => {
        resetSaturationForTests();
        delete process.env.CHAOS_FAULT_TOKEN;
        delete process.env.CANARY_FAULT_TOKEN;
    });

    it('está deshabilitado por defecto (404 sin token)', async () => {
        const app = buildApp();
        try {
            const respuesta = await app.inject({
                method: 'POST',
                url: '/api/v3/__test/saturation/start',
                payload: { holdMs: 100, durationSec: 5 },
            });
            expect(respuesta.statusCode).toBe(404);
        } finally {
            await app.close();
        }
    });

    it('activa, consulta estado y desactiva con token válido', async () => {
        process.env.CHAOS_FAULT_TOKEN = TOKEN;
        const app = buildApp();
        try {
            const start = await app.inject({
                method: 'POST',
                url: '/api/v3/__test/saturation/start',
                headers: { 'x-chaos-token': TOKEN },
                payload: { holdMs: 50, maxInflight: 2, durationSec: 10 },
            });
            expect(start.statusCode).toBe(202);
            expect(start.json().status.active).toBe(true);

            const status = await app.inject({
                method: 'GET',
                url: '/api/v3/__test/saturation',
                headers: { 'x-chaos-token': TOKEN },
            });
            expect(status.statusCode).toBe(200);
            expect(status.json().active).toBe(true);
            expect(status.json().config.holdMs).toBe(50);

            const stop = await app.inject({
                method: 'POST',
                url: '/api/v3/__test/saturation/stop',
                headers: { 'x-chaos-token': TOKEN },
            });
            expect(stop.statusCode).toBe(200);
            expect(stop.json().status.active).toBe(false);
        } finally {
            await app.close();
        }
    });

    it('acota holdMs y durationSec a límites seguros', async () => {
        process.env.CHAOS_FAULT_TOKEN = TOKEN;
        const app = buildApp();
        try {
            const start = await app.inject({
                method: 'POST',
                url: '/api/v3/__test/saturation/start',
                headers: { 'x-chaos-token': TOKEN },
                payload: { holdMs: 99999, maxInflight: 999, durationSec: 9999 },
            });
            const config = start.json().status.config;
            expect(config.holdMs).toBeLessThanOrEqual(2000);
            expect(config.maxInflight).toBeLessThanOrEqual(32);
            expect(config.durationSec).toBeLessThanOrEqual(120);
        } finally {
            await app.close();
            resetSaturationForTests();
        }
    });
});
