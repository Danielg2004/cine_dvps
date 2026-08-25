import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';

const app = buildApp();

describe('Integración de reservas', () => {

    it('debe responder correctamente al GET /reservas', async () => {

        const response = await app.inject({
            method: 'GET',
            url: '/reservas'
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(Array.isArray(body)).toBe(true);
    });

});

afterAll(async () => {
    await app.close();
});