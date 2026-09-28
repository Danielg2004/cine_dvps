import type { FastifyInstance } from 'fastify';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Reserva } from '../../entities/Reserva.js';

export async function reservasV2Routes(app: FastifyInstance) {

    // GET - Obtener todas las reservas
    app.get('/reservas', async () => {

        const reservaRepository = AppDataSourceV2.getRepository(Reserva);

        const reservas = await reservaRepository.find();

        return reservas;
    });

}