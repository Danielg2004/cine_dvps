import type { FastifyInstance } from 'fastify';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Reserva } from '../../entities/Reserva.js';

export async function reservasV2Routes(app: FastifyInstance) {


    app.get('/reservas', async () => {

        const reservaRepository = AppDataSourceV2.getRepository(Reserva);

        const reservas = await reservaRepository.find();

        return reservas;
    });



    app.get<{ Params: { id: string } }>(
        '/reservas/:id',
        async (request, reply) => {

            const id = Number(request.params.id);

            const reservaRepository = AppDataSourceV2.getRepository(Reserva);

            const reserva = await reservaRepository.findOneBy({ id });

            if (!reserva) {
                return reply.code(404).send({
                    mensaje: 'reserva no encontrada'
                });
            }

            return reserva;
        }
    );

}