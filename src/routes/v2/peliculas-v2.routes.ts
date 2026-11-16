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

            const traceHeader =
                request.headers['x-trace-id'];

            const traceId =
                typeof traceHeader === 'string' && traceHeader.length > 0
                    ? traceHeader
                    : randomUUID();

            reply.header('x-trace-id', traceId);

            if (!Number.isInteger(id) || id <= 0) {
                return reply.code(400).send({
                    mensaje: 'identificador de pelicula invalido',
                    traceId,
                });
            }

            const cacheKey = `pelicula:${id}`;

            // Cache es opcional: fallos degradan a base de datos (contrato Sports).
            const cached =
                await obtenerCache(
                    cacheKey,
                    traceId
                );

            if (cached && cached.value !== undefined) {
                return reply.send({
                    origen: 'cache',
                    traceId,
                    pelicula: cached.value,
                });
            }

            const peliculaRepository =
                AppDataSourceV2.getRepository(Pelicula);

            const pelicula =
                await peliculaRepository.findOneBy({ id });

            if (!pelicula) {
                return reply.code(404).send({
                    mensaje: 'pelicula no encontrada',
                    traceId,
                });
            }

            await guardarCache(
                cacheKey,
                pelicula,
                300,
                traceId
            );

            return reply.send({
                origen: 'database',
                traceId,
                pelicula,
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