import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';

const app = buildApp();

describe('Integración de reservas', () => {

    // GET - Obtener todas las reservas
    it('debe responder correctamente al GET /reservas', async () => {

        const response = await app.inject({
            method: 'GET',
            url: '/reservas'
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(Array.isArray(body)).toBe(true);
    });


    // POST - Crear una reserva
    it('debe crear una reserva con POST /reservas', async () => {

        // Crear película
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

        // Crear sala
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

        // Crear reserva
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


    // GET POR ID - Obtener una reserva específica
    it('debe obtener una reserva por ID', async () => {

        // Crear película
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

        // Crear sala
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

        // Crear reserva
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

        // Buscar reserva por ID
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


    // PUT - Actualizar una reserva
    it('debe actualizar una reserva con PUT /reservas/:id', async () => {

        // Crear película
        const peliculaResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula para actualizar reserva',
                duracion: 125,
                genero: 'Accion',
                descripcion: 'Pelicula utilizada para probar PUT de reserva'
            }
        });

        const pelicula = peliculaResponse.json();

        // Crear sala
        const salaResponse = await app.inject({
            method: 'POST',
            url: '/salas',
            payload: {
                numero: 70,
                capacidad: 100,
                hora_de_inicio: '18:00:00',
                pelicula_id: pelicula.id
            }
        });

        const sala = salaResponse.json();

        // Crear reserva
        const reservaResponse = await app.inject({
            method: 'POST',
            url: '/reservas',
            payload: {
                pelicula_id: pelicula.id,
                sala_id: sala.id,
                cantidad_de_entradas: 2,
                precio_total: 30000,
                nombre_cliente: 'Cliente original',
                fecha_reserva: '2026-08-25',
                hora_reserva: '16:00:00'
            }
        });

        const reservaCreada = reservaResponse.json();

        // Actualizar reserva
        const response = await app.inject({
            method: 'PUT',
            url: `/reservas/${reservaCreada.id}`,
            payload: {
                pelicula_id: pelicula.id,
                sala_id: sala.id,
                cantidad_de_entradas: 4,
                precio_total: 60000,
                nombre_cliente: 'Cliente actualizado',
                fecha_reserva: '2026-08-26',
                hora_reserva: '17:00:00'
            }
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body.id).toBe(reservaCreada.id);
        expect(body.pelicula_id).toBe(pelicula.id);
        expect(body.sala_id).toBe(sala.id);
        expect(body.cantidad_de_entradas).toBe(4);
        expect(body.precio_total).toBe(60000);
        expect(body.nombre_cliente).toBe('Cliente actualizado');
    });


    // DELETE - Eliminar una reserva
    it('debe eliminar una reserva con DELETE /reservas/:id', async () => {

        // Crear película
        const peliculaResponse = await app.inject({
            method: 'POST',
            url: '/peliculas',
            payload: {
                nombre: 'Pelicula para eliminar reserva',
                duracion: 100,
                genero: 'Suspenso',
                descripcion: 'Pelicula utilizada para probar DELETE de reserva'
            }
        });

        const pelicula = peliculaResponse.json();

        // Crear sala
        const salaResponse = await app.inject({
            method: 'POST',
            url: '/salas',
            payload: {
                numero: 80,
                capacidad: 90,
                hora_de_inicio: '21:00:00',
                pelicula_id: pelicula.id
            }
        });

        const sala = salaResponse.json();

        // Crear reserva
        const reservaResponse = await app.inject({
            method: 'POST',
            url: '/reservas',
            payload: {
                pelicula_id: pelicula.id,
                sala_id: sala.id,
                cantidad_de_entradas: 2,
                precio_total: 30000,
                nombre_cliente: 'Cliente para eliminar',
                fecha_reserva: '2026-08-25',
                hora_reserva: '18:00:00'
            }
        });

        const reservaCreada = reservaResponse.json();

        // Eliminar reserva
        const response = await app.inject({
            method: 'DELETE',
            url: `/reservas/${reservaCreada.id}`
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body.mensaje).toBe('reserva eliminada');
    });

});


afterAll(async () => {
    await app.close();
});