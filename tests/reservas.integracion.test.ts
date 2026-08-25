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



    it('debe crear una reserva con POST /reservas', async () => {

        const peliculaResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula para reserva',
                duracion: 120,
                genero: 'Accion',
                descripcion: 'Pelicula creada para probar reservas'
            }
        });

        const pelicula = peliculaResponse.json();

        const salaResponse = await app.inject({
            method: 'POST',
            url: '/salas',
            payload: {
                numero: 50,
                capacidad: 100,
                hora_de_inicio: '19:00:00',
                pelicula_id: pelicula.id
            }
        });

        const sala = salaResponse.json();

        const response = await app.inject({
            method: 'POST',
            url: '/reservas',
            payload: {
                pelicula_id: pelicula.id,
                sala_id: sala.id,
                cantidad_de_entradas: 2,
                precio_total: 30000,
                nombre_cliente: 'Cliente de prueba',
                fecha_reserva: '2026-08-25',
                hora_reserva: '14:00:00'
            }
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body).toHaveProperty('id');
        expect(body.pelicula_id).toBe(pelicula.id);
        expect(body.sala_id).toBe(sala.id);
        expect(body.cantidad_de_entradas).toBe(2);
        expect(body.precio_total).toBe(30000);
        expect(body.nombre_cliente).toBe('Cliente de prueba');
    });


    
    it('debe obtener una reserva por ID', async () => {

  
        const peliculaResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula para GET reserva',
                duracion: 110,
                genero: 'Drama',
                descripcion: 'Pelicula para probar GET por ID de reserva'
            }
        });

        const pelicula = peliculaResponse.json();



        const salaResponse = await app.inject({
            method: 'POST',
            url: '/salas',
            payload: {
                numero: 60,
                capacidad: 80,
                hora_de_inicio: '20:00:00',
                pelicula_id: pelicula.id
            }
        });

        const sala = salaResponse.json();


        const reservaResponse = await app.inject({
            method: 'POST',
            url: '/reservas',
            payload: {
                pelicula_id: pelicula.id,
                sala_id: sala.id,
                cantidad_de_entradas: 3,
                precio_total: 45000,
                nombre_cliente: 'Cliente GET ID',
                fecha_reserva: '2026-08-25',
                hora_reserva: '15:00:00'
            }
        });

        const reservaCreada = reservaResponse.json();


     
        const response = await app.inject({
            method: 'GET',
            url: `/reservas/${reservaCreada.id}`
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body[0].id).toBe(reservaCreada.id);
        expect(body[0].pelicula_id).toBe(pelicula.id);
        expect(body[0].sala_id).toBe(sala.id);
        expect(body[0].cantidad_de_entradas).toBe(3);
        expect(body[0].nombre_cliente).toBe('Cliente GET ID');
    });

});


afterAll(async () => {
    await app.close();
});