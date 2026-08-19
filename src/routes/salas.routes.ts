import type { FastifyInstance } from 'fastify';
import { db } from '../database.js';

export async function salasRoutes(app: FastifyInstance) {

    // GET - Obtener todas las salas
    app.get('/salas', async () => {

        const [salas] = await db.query(
            'SELECT * FROM salas'
        );

        return salas;
    });


    // GET - Obtener una sala por ID
    app.get<{ Params: { id: string } }>(
        '/salas/:id',
        async (request) => {

            const id = Number(request.params.id);

            const [salas] = await db.query(
                'SELECT * FROM salas WHERE id = ?',
                [id]
            );

            return salas;
        }
    );


    // POST - Crear una sala
    app.post<{
        Body: {
            numero: number;
            capacidad: number;
            hora_de_inicio: string;
            pelicula_id: number;
        };
    }>('/salas', async (request) => {

        const {
            numero,
            capacidad,
            hora_de_inicio,
            pelicula_id
        } = request.body;

        const [resultado]: any = await db.query(
            `INSERT INTO salas
            (numero, capacidad, hora_de_inicio, pelicula_id)
            VALUES (?, ?, ?, ?)`,
            [
                numero,
                capacidad,
                hora_de_inicio,
                pelicula_id
            ]
        );

        return {
            id: resultado.insertId,
            numero,
            capacidad,
            hora_de_inicio,
            pelicula_id
        };
    });


    // PUT - Actualizar una sala
    app.put<{
        Params: { id: string };
        Body: {
            numero: number;
            capacidad: number;
            hora_de_inicio: string;
            pelicula_id: number;
        };
    }>('/salas/:id', async (request) => {

        const id = Number(request.params.id);

        const {
            numero,
            capacidad,
            hora_de_inicio,
            pelicula_id
        } = request.body;

        const [resultado]: any = await db.query(
            `UPDATE salas
            SET numero = ?,
                capacidad = ?,
                hora_de_inicio = ?,
                pelicula_id = ?
            WHERE id = ?`,
            [
                numero,
                capacidad,
                hora_de_inicio,
                pelicula_id,
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            return {
                mensaje: 'sala no encontrada'
            };
        }

        return {
            id,
            numero,
            capacidad,
            hora_de_inicio,
            pelicula_id
        };
    });


    // DELETE - Eliminar una sala
    app.delete<{
        Params: { id: string };
    }>('/salas/:id', async (request) => {

        const id = Number(request.params.id);

        const [resultado]: any = await db.query(
            'DELETE FROM salas WHERE id = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return {
                mensaje: 'sala no encontrada'
            };
        }

        return {
            mensaje: 'sala eliminada'
        };
    });

}