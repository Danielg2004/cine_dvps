import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Identificacion de versiones Canary', () => {

    it('identifica la version stable', async () => {
        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/health'
            });

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['x-app-version']).toBe('2.0.0');
            expect(respuesta.headers['x-app-track']).toBe('stable');
        } finally {
            await app.close();
        }
    });

    it('identifica la version canary', async () => {
        const versionAnterior = process.env.APP_VERSION;
        const trackAnterior = process.env.APP_TRACK;

        process.env.APP_VERSION = '3.0.0';
        process.env.APP_TRACK = 'canary';

        let app;

        try {
            app = buildApp();

            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/health'
            });

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['x-app-version']).toBe('3.0.0');
            expect(respuesta.headers['x-app-track']).toBe('canary');
        } finally {
            if (app) await app.close();

            if (versionAnterior === undefined) {
                delete process.env.APP_VERSION;
            } else {
                process.env.APP_VERSION = versionAnterior;
            }

            if (trackAnterior === undefined) {
                delete process.env.APP_TRACK;
            } else {
                process.env.APP_TRACK = trackAnterior;
            }
        }
    });
});
