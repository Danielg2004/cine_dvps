import type { FastifyInstance } from 'fastify';
import { db } from '../database.js';

export async function peliculasRoutes(app: FastifyInstance) {

    // GET - Obtener todas las películas
    app.get('/peliculas', async () => {

        const [peliculas] = await db.query(
            'SELECT * FROM peliculas'
        );

        return peliculas;
    });


    // GET - Obtener una película por ID
    app.get<{ Params: { id: string } }>(
        '/peliculas/:id',
        async (request) => {

            const id = Number(request.params.id);

            const [peliculas] = await db.query(
                'SELECT * FROM peliculas WHERE id = ?',
                [id]
            );

            return peliculas;
        }
    );


    // POST - Crear una película
    app.post<{
        Body: {
            nombre: string;
            duracion: number;
            genero: string;
            descripcion: string;
        };
    }>('/peliculas', async (request) => {

        const {
            nombre,
            duracion,
            genero,
            descripcion
        } = request.body;

        const [resultado]: any = await db.query(
            `INSERT INTO peliculas
            (nombre, duracion, genero, descripcion)
            VALUES (?, ?, ?, ?)`,
            [
                nombre,
                duracion,
                genero,
                descripcion
            ]
        );

        return {
            id: resultado.insertId,
            nombre,
            duracion,
            genero,
            descripcion
        };
    });


    // PUT - Actualizar una película
    app.put<{
        Params: { id: string };
        Body: {
            nombre: string;
            duracion: number;
            genero: string;
            descripcion: string;
        };
    }>('/peliculas/:id', async (request) => {

        const id = Number(request.params.id);

        const {
            nombre,
            duracion,
            genero,
            descripcion
        } = request.body;

        const [resultado]: any = await db.query(
            `UPDATE peliculas
            SET nombre = ?,
                duracion = ?,
                genero = ?,
                descripcion = ?
            WHERE id = ?`,
            [
                nombre,
                duracion,
                genero,
                descripcion,
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            return {
                mensaje: 'pelicula no encontrada'
            };
        }

        return {
            id,
            nombre,
            duracion,
            genero,
            descripcion
        };
    });


    // DELETE - Eliminar una película
    app.delete<{
        Params: { id: string };
    }>('/peliculas/:id', async (request) => {

        const id = Number(request.params.id);

        const [resultado]: any = await db.query(
            'DELETE FROM peliculas WHERE id = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return {
                mensaje: 'pelicula no encontrada'
            };
        }

        return {
            mensaje: 'pelicula eliminada'
        };
    });

}
