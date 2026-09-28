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



    app.post<{
        Body: {
            pelicula_id: number;
            sala_id: number;
            cantidad_de_entradas: number;
            precio_total: number;
            nombre_cliente: string;
            fecha_reserva: string;
            hora_reserva: string;
        };
    }>('/reservas', async (request, reply) => {

        const {
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        } = request.body;

        const reservaRepository = AppDataSourceV2.getRepository(Reserva);

        const nuevaReserva = reservaRepository.create({
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        });

        const reservaGuardada = await reservaRepository.save(nuevaReserva);

        return reply.code(201).send(reservaGuardada);
    });



    app.put<{
        Params: { id: string };
        Body: {
            pelicula_id: number;
            sala_id: number;
            cantidad_de_entradas: number;
            precio_total: number;
            nombre_cliente: string;
            fecha_reserva: string;
            hora_reserva: string;
        };
    }>('/reservas/:id', async (request, reply) => {

        const id = Number(request.params.id);

        const reservaRepository = AppDataSourceV2.getRepository(Reserva);

        const reserva = await reservaRepository.findOneBy({ id });

        if (!reserva) {
            return reply.code(404).send({
                mensaje: 'reserva no encontrada'
            });
        }

        const {
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        } = request.body;

        reserva.pelicula_id = pelicula_id;
        reserva.sala_id = sala_id;
        reserva.cantidad_de_entradas = cantidad_de_entradas;
        reserva.precio_total = precio_total;
        reserva.nombre_cliente = nombre_cliente;
        reserva.fecha_reserva = fecha_reserva;
        reserva.hora_reserva = hora_reserva;

        const reservaActualizada = await reservaRepository.save(reserva);

        return reservaActualizada;
    });



    app.delete<{
        Params: { id: string };
    }>('/reservas/:id', async (request, reply) => {

        const id = Number(request.params.id);

        const reservaRepository = AppDataSourceV2.getRepository(Reserva);

        const reserva = await reservaRepository.findOneBy({ id });

        if (!reserva) {
            return reply.code(404).send({
                mensaje: 'reserva no encontrada'
            });
        }

        await reservaRepository.remove(reserva);

        return {
            mensaje: 'reserva eliminada'
        };
    });

}