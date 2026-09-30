import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Pelicula } from '../../entities/Pelicula.js';
import { obtenerCache, guardarCache } from '../../clients/cache.client.js';


export async function peliculasV2Routes(app: FastifyInstance) {


    app.get('/peliculas', async () => {

        const peliculaRepository =
            AppDataSourceV2.getRepository(Pelicula);

        const peliculas =
            await peliculaRepository.find();

        return peliculas;
    });



    app.get<{ Params: { id: string } }>(
        '/peliculas/:id',
        async (request, reply) => {

            const id = Number(request.params.id);


            // Obtener trazabilidad
            const traceHeader =
                request.headers['x-trace-id'];


            const traceId =
                typeof traceHeader === 'string'
                    ? traceHeader
                    : randomUUID();



            const cacheKey = `pelicula:${id}`;



            // 1. Consultar primero en cache
            const cached =
                await obtenerCache(
                    cacheKey,
                    traceId
                );



            if (cached) {

                return reply.send({
                    origen: 'cache',
                    traceId,
                    pelicula: cached.value
                });

            }



            // 2. Si no existe en cache, consultar BD
            const peliculaRepository =
                AppDataSourceV2.getRepository(Pelicula);



            const pelicula =
                await peliculaRepository.findOneBy({ id });



            if (!pelicula) {

                return reply.code(404).send({
                    mensaje: 'pelicula no encontrada',
                    traceId
                });

            }



            // 3. Guardar resultado en cache
            await guardarCache(
                cacheKey,
                pelicula,
                300,
                traceId
            );



            // 4. Responder
            return reply.send({
                origen: 'database',
                traceId,
                pelicula
            });

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



        const peliculaRepository =
            AppDataSourceV2.getRepository(Pelicula);



        const nuevaPelicula =
            peliculaRepository.create({
                nombre,
                duracion,
                genero,
                descripcion
            });



        const peliculaGuardada =
            await peliculaRepository.save(
                nuevaPelicula
            );



        return reply.code(201).send(
            peliculaGuardada
        );

    });




    app.put<{
        Params: { id: string };
        Body: {
            nombre: string;
            duracion: number;
            genero: string;
            descripcion: string;
        };
    }>('/peliculas/:id', async (request, reply) => {


        const id =
            Number(request.params.id);



        const peliculaRepository =
            AppDataSourceV2.getRepository(Pelicula);



        const pelicula =
            await peliculaRepository.findOneBy({ id });



        if (!pelicula) {

            return reply.code(404).send({
                mensaje: 'pelicula no encontrada'
            });

        }



        const {
            nombre,
            duracion,
            genero,
            descripcion
        } = request.body;



        pelicula.nombre = nombre;
        pelicula.duracion = duracion;
        pelicula.genero = genero;
        pelicula.descripcion = descripcion;



        const peliculaActualizada =
            await peliculaRepository.save(
                pelicula
            );



        return peliculaActualizada;

    });




    app.delete<{
        Params: { id: string };
    }>('/peliculas/:id', async (request, reply) => {


        const id =
            Number(request.params.id);



        const peliculaRepository =
            AppDataSourceV2.getRepository(Pelicula);



        const pelicula =
            await peliculaRepository.findOneBy({ id });



        if (!pelicula) {

            return reply.code(404).send({
                mensaje: 'pelicula no encontrada'
            });

        }



        await peliculaRepository.remove(
            pelicula
        );



        return {
            mensaje: 'pelicula eliminada'
        };

    });

}