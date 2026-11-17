import type { FastifyInstance } from 'fastify';
import { db } from '../../database.js';

interface PeliculasQuery {
    genero?: string;
}

export async function peliculasV3Routes(app: FastifyInstance) {

    app.get<{ Querystring: PeliculasQuery }>(
        '/peliculas',
        async (request, reply) => {

            const genero = request.query.genero?.trim();

            if (request.query.genero !== undefined && !genero) {
                return reply.code(400).send({
                    error: 'El genero no puede estar vacio'
                });
            }

            if (genero) {
                const [peliculas] = await db.query(
                    'SELECT * FROM peliculas WHERE LOWER(genero) = LOWER(?) ORDER BY id',
                    [genero]
                );

                return peliculas;
            }

            const [peliculas] = await db.query(
                'SELECT * FROM peliculas ORDER BY id'
            );

            return peliculas;
        }
    );
}
