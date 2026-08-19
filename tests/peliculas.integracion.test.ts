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


    it('debe crear una pelicula con POST /peliculas', async () => {

        const response = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula de prueba',
                duracion: 120,
                genero: 'Accion',
                descripcion: 'Pelicula creada durante la prueba'
            }
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body).toHaveProperty('id');
        expect(body.nombre).toBe('Pelicula de prueba');
        expect(body.duracion).toBe(120);
    });

});


afterAll(async () => {
    await app.close();
});