import type { FastifyInstance } from 'fastify';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Pelicula } from '../../entities/Pelicula.js';

export async function peliculasV2Routes(app: FastifyInstance) {

    app.get('/peliculas', async () => {

        const peliculaRepository = AppDataSourceV2.getRepository(Pelicula);

        const peliculas = await peliculaRepository.find();

        return peliculas;
    });

}