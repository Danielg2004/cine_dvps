import type { FastifyInstance } from 'fastify';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Sala } from '../../entities/Sala.js';

export async function salasV2Routes(app: FastifyInstance) {


    app.get('/salas', async () => {

        const salaRepository = AppDataSourceV2.getRepository(Sala);

        const salas = await salaRepository.find();

        return salas;
    });


 
    app.get<{ Params: { id: string } }>(
        '/salas/:id',
        async (request, reply) => {

            const id = Number(request.params.id);

            const salaRepository = AppDataSourceV2.getRepository(Sala);

            const sala = await salaRepository.findOneBy({ id });

            if (!sala) {
                return reply.code(404).send({
                    mensaje: 'sala no encontrada'
                });
            }

            return sala;
        }
    );



    app.post<{
        Body: {
            numero: number;
            capacidad: number;
            hora_de_inicio: string;
            pelicula_id: number;
        };
    }>('/salas', async (request, reply) => {

        const {
            numero,
            capacidad,
            hora_de_inicio,
            pelicula_id
        } = request.body;

        const salaRepository = AppDataSourceV2.getRepository(Sala);

        const nuevaSala = salaRepository.create({
            numero,
            capacidad,
            hora_de_inicio,
            pelicula_id
        });

        const salaGuardada = await salaRepository.save(nuevaSala);

        return reply.code(201).send(salaGuardada);
    });


  
    app.put<{
        Params: { id: string };
        Body: {
            numero: number;
            capacidad: number;
            hora_de_inicio: string;
            pelicula_id: number;
        };
    }>('/salas/:id', async (request, reply) => {

        const id = Number(request.params.id);

        const salaRepository = AppDataSourceV2.getRepository(Sala);

        const sala = await salaRepository.findOneBy({ id });

        if (!sala) {
            return reply.code(404).send({
                mensaje: 'sala no encontrada'
            });
        }

        const {
            numero,
            capacidad,
            hora_de_inicio,
            pelicula_id
        } = request.body;

        sala.numero = numero;
        sala.capacidad = capacidad;
        sala.hora_de_inicio = hora_de_inicio;
        sala.pelicula_id = pelicula_id;

        const salaActualizada = await salaRepository.save(sala);

        return salaActualizada;
    });


  
    app.delete<{
        Params: { id: string };
    }>('/salas/:id', async (request, reply) => {

        const id = Number(request.params.id);

        const salaRepository = AppDataSourceV2.getRepository(Sala);

        const sala = await salaRepository.findOneBy({ id });

        if (!sala) {
            return reply.code(404).send({
                mensaje: 'sala no encontrada'
            });
        }

        await salaRepository.remove(sala);

        return {
            mensaje: 'sala eliminada'
        };
    });

}