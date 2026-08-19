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


 
    it('debe obtener una pelicula por ID', async () => {

        const crearResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula GET ID',
                duracion: 110,
                genero: 'Drama',
                descripcion: 'Pelicula para probar GET por ID'
            }
        });

        const peliculaCreada = crearResponse.json();

        const response = await app.inject({
            method: 'GET',
            url: `/peliculas/${peliculaCreada.id}`
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body[0].id).toBe(peliculaCreada.id);
        expect(body[0].nombre).toBe('Pelicula GET ID');
    });



    it('debe actualizar una pelicula con PUT /peliculas/:id', async () => {

        const crearResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula antes de actualizar',
                duracion: 100,
                genero: 'Accion',
                descripcion: 'Descripcion original'
            }
        });

        const peliculaCreada = crearResponse.json();

        const response = await app.inject({
            method: 'PUT',
            url: `/peliculas/${peliculaCreada.id}`,
            payload: {
                nombre: 'Pelicula actualizada',
                duracion: 130,
                genero: 'Ciencia ficcion',
                descripcion: 'Descripcion actualizada'
            }
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body.id).toBe(peliculaCreada.id);
        expect(body.nombre).toBe('Pelicula actualizada');
        expect(body.duracion).toBe(130);
        expect(body.genero).toBe('Ciencia ficcion');
    });


   
    it('debe eliminar una pelicula con DELETE /peliculas/:id', async () => {

  
        const crearResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula para eliminar',
                duracion: 90,
                genero: 'Terror',
                descripcion: 'Pelicula creada para probar DELETE'
            }
        });

        const peliculaCreada = crearResponse.json();


        const response = await app.inject({
            method: 'DELETE',
            url: `/peliculas/${peliculaCreada.id}`
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body.mensaje).toBe('pelicula eliminada');
    });

});


afterAll(async () => {
    await app.close();
});