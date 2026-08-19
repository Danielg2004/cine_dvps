import type { FastifyInstance } from 'fastify';
import { db } from '../database.js';

export async function reservasRoutes(app: FastifyInstance) {

    // GET - Obtener todas las reservas
    app.get('/reservas', async () => {

        const [reservas] = await db.query(
            'SELECT * FROM reservas'
        );

        return reservas;
    });


    // GET - Obtener una reserva por ID
    app.get<{ Params: { id: string } }>(
        '/reservas/:id',
        async (request) => {

            const id = Number(request.params.id);

            const [reservas] = await db.query(
                'SELECT * FROM reservas WHERE id = ?',
                [id]
            );

            return reservas;
        }
    );


    // POST - Crear una reserva
    app.post<{
        Body: {
            pelicula_id: number;
            sala_id: number;
            cantidad_de_entradas: number;
            precio_total: number;
            nombre_cliente: string;
            fecha_reserva: string;
            hora_reserva: string;
        };
    }>('/reservas', async (request) => {

        const {
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        } = request.body;

        const [resultado]: any = await db.query(
            `INSERT INTO reservas
            (
                pelicula_id,
                sala_id,
                cantidad_de_entradas,
                precio_total,
                nombre_cliente,
                fecha_reserva,
                hora_reserva
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                pelicula_id,
                sala_id,
                cantidad_de_entradas,
                precio_total,
                nombre_cliente,
                fecha_reserva,
                hora_reserva
            ]
        );

        return {
            id: resultado.insertId,
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        };
    });


    // PUT - Actualizar una reserva
    app.put<{
        Params: { id: string };
        Body: {
            pelicula_id: number;
            sala_id: number;
            cantidad_de_entradas: number;
            precio_total: number;
            nombre_cliente: string;
            fecha_reserva: string;
            hora_reserva: string;
        };
    }>('/reservas/:id', async (request) => {

        const id = Number(request.params.id);

        const {
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        } = request.body;

        const [resultado]: any = await db.query(
            `UPDATE reservas
            SET pelicula_id = ?,
                sala_id = ?,
                cantidad_de_entradas = ?,
                precio_total = ?,
                nombre_cliente = ?,
                fecha_reserva = ?,
                hora_reserva = ?
            WHERE id = ?`,
            [
                pelicula_id,
                sala_id,
                cantidad_de_entradas,
                precio_total,
                nombre_cliente,
                fecha_reserva,
                hora_reserva,
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            return {
                mensaje: 'reserva no encontrada'
            };
        }

        return {
            id,
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        };
    });


    // DELETE - Eliminar una reserva
    app.delete<{
        Params: { id: string };
    }>('/reservas/:id', async (request) => {

        const id = Number(request.params.id);

        const [resultado]: any = await db.query(
            'DELETE FROM reservas WHERE id = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return {
                mensaje: 'reserva no encontrada'
            };
        }

        return {
            mensaje: 'reserva eliminada'
        };
    });

}