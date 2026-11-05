import type { FastifyInstance } from 'fastify';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Sala } from '../../entities/Sala.js';
import { Reserva } from '../../entities/Reserva.js';

export async function ocupacionV3Routes(app: FastifyInstance) {

    app.get<{
        Querystring: { fecha?: string; hora?: string };
    }>('/salas/ocupacion', async (request, reply) => {

        const { fecha, hora } = request.query;

        if (
            !fecha ||
            !hora ||
            !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
            !/^\d{2}:\d{2}(:\d{2})?$/.test(hora)
        ) {
            return reply.code(400).send({
                mensaje: 'Debe proporcionar fecha (YYYY-MM-DD) y hora (HH:mm)'
            });
        }

        const horaNormalizada =
            hora.length === 5 ? `${hora}:00` : hora;

        const salaRepository = AppDataSourceV2.getRepository(Sala);
        const reservaRepository = AppDataSourceV2.getRepository(Reserva);

        const salas = await salaRepository.find();

        const reservas = await reservaRepository.find({
            where: {
                fecha_reserva: fecha,
                hora_reserva: horaNormalizada
            }
        });

        const idsSalas = new Set(salas.map(sala => sala.id));

        const capacidadTotal = salas.reduce(
            (total, sala) => total + sala.capacidad,
            0
        );

        const entradasReservadas = reservas.reduce(
            (total, reserva) =>
                idsSalas.has(reserva.sala_id)
                    ? total + reserva.cantidad_de_entradas
                    : total,
            0
        );

        const cuposDisponibles = Math.max(
            0,
            capacidadTotal - entradasReservadas
        );

        const ocupacionPorcentaje =
            capacidadTotal > 0
                ? Number(
                    (
                        entradasReservadas / capacidadTotal * 100
                    ).toFixed(2)
                )
                : 0;

        return {
            fecha,
            hora: horaNormalizada,
            totalSalas: salas.length,
            capacidadTotal,
            entradasReservadas,
            cuposDisponibles,
            ocupacionPorcentaje
        };
    });
}
