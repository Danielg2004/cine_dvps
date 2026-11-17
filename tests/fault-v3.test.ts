import { afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { faultV3Routes } from '../src/routes/v3/fault-v3.routes.js';

const token = 'token-canary-pruebas-2026';

const trackOriginal = process.env.APP_TRACK;
const tokenOriginal = process.env.CANARY_FAULT_TOKEN;

afterEach(() => {
    if (trackOriginal === undefined) {
        delete process.env.APP_TRACK;
    } else {
        process.env.APP_TRACK = trackOriginal;
    }

    if (tokenOriginal === undefined) {
        delete process.env.CANARY_FAULT_TOKEN;
    } else {
        process.env.CANARY_FAULT_TOKEN = tokenOriginal;
    }
});

describe('Inyeccion controlada de fallos Canary V4', () => {

    async function crearApp() {
        const app = Fastify();
        await app.register(faultV3Routes, { prefix: '/api/v3' });
        await app.ready();
        return app;
    }

    it('rechaza solicitudes cuando no hay token configurado', async () => {
        process.env.APP_TRACK = 'canary';
        delete process.env.CANARY_FAULT_TOKEN;

        const app = await crearApp();

        try {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v3/__test/fault?tipo=error',
                headers: { 'x-canary-test-token': token }
            });

            expect(response.statusCode).toBe(404);
        } finally {
            await app.close();
        }
    });

    it('rechaza tokens incorrectos', async () => {
        process.env.APP_TRACK = 'canary';
        process.env.CANARY_FAULT_TOKEN = token;

        const app = await crearApp();

        try {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v3/__test/fault?tipo=error',
                headers: { 'x-canary-test-token': 'token-incorrecto-2026' }
            });

            expect(response.statusCode).toBe(404);
        } finally {
            await app.close();
        }
    });

    it('simula un error HTTP 500 autorizado', async () => {
        process.env.APP_TRACK = 'canary';
        process.env.CANARY_FAULT_TOKEN = token;

        const app = await crearApp();

        try {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v3/__test/fault?tipo=error',
                headers: { 'x-canary-test-token': token }
            });

            expect(response.statusCode).toBe(500);
            expect(response.json().tipo).toBe('error');
        } finally {
            await app.close();
        }
    });

    it('simula latencia autorizada', async () => {
        process.env.APP_TRACK = 'canary';
        process.env.CANARY_FAULT_TOKEN = token;

        const app = await crearApp();

        try {
            const inicio = performance.now();

            const response = await app.inject({
                method: 'GET',
                url: '/api/v3/__test/fault?tipo=latencia',
                headers: { 'x-canary-test-token': token }
            });

            const duracion = performance.now() - inicio;

            expect(response.statusCode).toBe(200);
            expect(duracion).toBeGreaterThanOrEqual(1400);
        } finally {
            await app.close();
        }
    });

    it('mantiene deshabilitada la ruta en Stable', async () => {
        process.env.APP_TRACK = 'stable';
        process.env.CANARY_FAULT_TOKEN = token;

        const app = await crearApp();

        try {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v3/__test/fault?tipo=error',
                headers: { 'x-canary-test-token': token }
            });

            expect(response.statusCode).toBe(404);
        } finally {
            await app.close();
        }
    });
});
