import type { FastifyInstance } from 'fastify';
import { AppDataSourceV2 } from '../../config/database-v2.js';
import { Sala } from '../../entities/Sala.js';
import { Reserva } from '../../entities/Reserva.js';

export async function disponibilidadV3Routes(app: FastifyInstance) {

    app.get<{
        Params: { id: string };
        Querystring: { fecha?: string; hora?: string };
    }>('/salas/:id/disponibilidad', async (request, reply) => {

        const id = Number(request.params.id);
        const { fecha, hora } = request.query;

        if (!Number.isInteger(id) || id <= 0) {
            return reply.code(400).send({
                mensaje: 'El identificador de sala no es valido'
            });
        }

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

        const salaRepository = AppDataSourceV2.getRepository(Sala);
        const reservaRepository = AppDataSourceV2.getRepository(Reserva);

        const sala = await salaRepository.findOneBy({ id });

        if (!sala) {
            return reply.code(404).send({
                mensaje: 'Sala no encontrada'
            });
        }

        const horaNormalizada =
            hora.length === 5 ? `${hora}:00` : hora;

        const reservas = await reservaRepository.find({
            where: {
                sala_id: id,
                fecha_reserva: fecha,
                hora_reserva: horaNormalizada
            }
        });

        const entradasReservadas = reservas.reduce(
            (total, reserva) =>
                total + reserva.cantidad_de_entradas,
            0
        );

        const cuposDisponibles = Math.max(
            0,
            sala.capacidad - entradasReservadas
        );

        return {
            salaId: sala.id,
            numeroSala: sala.numero,
            fecha,
            hora: horaNormalizada,
            capacidadTotal: sala.capacidad,
            entradasReservadas,
            cuposDisponibles,
            ocupacionPorcentaje:
                sala.capacidad > 0
                    ? Number(
                        (
                            (entradasReservadas / sala.capacidad) *
                            100
                        ).toFixed(2)
                    )
                    : 0
        };
    });
}
