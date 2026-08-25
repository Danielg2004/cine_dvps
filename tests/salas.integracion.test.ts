import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';

const app = buildApp();

describe('Integración de salas', () => {

    it('debe responder correctamente al GET /salas', async () => {

        const response = await app.inject({
            method: 'GET',
            url: '/salas'
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(Array.isArray(body)).toBe(true);
    });



    it('debe crear una sala con POST /salas', async () => {

        const peliculaResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula para sala',
                duracion: 120,
                genero: 'Accion',
                descripcion: 'Pelicula creada para probar salas'
            }
        });

        const pelicula = peliculaResponse.json();

        const response = await app.inject({
            method: 'POST',
            url: '/salas',
            payload: {
                numero: 10,
                capacidad: 100,
                hora_de_inicio: '18:00:00',
                pelicula_id: pelicula.id
            }
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body).toHaveProperty('id');
        expect(body.numero).toBe(10);
        expect(body.capacidad).toBe(100);
        expect(body.pelicula_id).toBe(pelicula.id);
    });


   
    it('debe obtener una sala por ID', async () => {

   
        const peliculaResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula para GET sala',
                duracion: 115,
                genero: 'Drama',
                descripcion: 'Pelicula para probar GET por ID de sala'
            }
        });

        const pelicula = peliculaResponse.json();

   
        const salaResponse = await app.inject({
            method: 'POST',
            url: '/salas',
            payload: {
                numero: 20,
                capacidad: 80,
                hora_de_inicio: '20:00:00',
                pelicula_id: pelicula.id
            }
        });

        const salaCreada = salaResponse.json();

  
        const response = await app.inject({
            method: 'GET',
            url: `/salas/${salaCreada.id}`
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body[0].id).toBe(salaCreada.id);
        expect(body[0].numero).toBe(20);
        expect(body[0].capacidad).toBe(80);
        expect(body[0].pelicula_id).toBe(pelicula.id);
    });

});

afterAll(async () => {
    await app.close();
});