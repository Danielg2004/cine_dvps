import type { FastifyInstance } from 'fastify';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Pelicula } from '../../entities/Pelicula.js';

export async function peliculasV2Routes(app: FastifyInstance) {


    app.get('/peliculas', async () => {

        const peliculaRepository = AppDataSourceV2.getRepository(Pelicula);

        const peliculas = await peliculaRepository.find();

        return peliculas;
    });



    app.get<{ Params: { id: string } }>(
        '/peliculas/:id',
        async (request, reply) => {

            const id = Number(request.params.id);

            const peliculaRepository = AppDataSourceV2.getRepository(Pelicula);

            const pelicula = await peliculaRepository.findOneBy({ id });

            if (!pelicula) {
                return reply.code(404).send({
                    mensaje: 'pelicula no encontrada'
                });
            }

            return pelicula;
        }
    );


  
    app.post<{
        Body: {
            nombre: string;
            duracion: number;
            genero: string;
            descripcion: string;
        };
    }>('/peliculas', async (request, reply) => {

        const {
            nombre,
            duracion,
            genero,
            descripcion
        } = request.body;

        const peliculaRepository = AppDataSourceV2.getRepository(Pelicula);

        const nuevaPelicula = peliculaRepository.create({
            nombre,
            duracion,
            genero,
            descripcion
        });

        const peliculaGuardada = await peliculaRepository.save(nuevaPelicula);

        return reply.code(201).send(peliculaGuardada);
    });

}