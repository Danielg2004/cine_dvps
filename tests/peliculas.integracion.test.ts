import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';

const app = buildApp();

describe('Integración de películas', () => {

    it('debe responder correctamente al GET /peliculas', async () => {

        const response = await app.inject({
            method: 'GET',
            url: '/peliculas'
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(Array.isArray(body)).toBe(true);
    });

});

afterAll(async () => {
    await app.close();
});