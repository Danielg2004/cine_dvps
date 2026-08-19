import type { FastifyInstance } from 'fastify';
import { reservas } from '../data/reserva.js';

export async function reservasRoutes(app: FastifyInstance) {


    app.get('/reservas', async () => {
        return reservas;
    });

    // GET - Obtener una reserva por ID
    app.get<{ Params: { id: string } }>('/reservas/:id', async (request) => {

        const id = Number(request.params.id);

        const reserva = reservas.find((reserva) => reserva.id === id);

        return { reserva };
    });


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
    }>('/reservas', async (request) => {

        const {
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        } = request.body;

        const id = reservas.length + 1;

        const nuevaReserva = {
            id,
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        };

        reservas.push(nuevaReserva);

        return nuevaReserva;
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
    }>('/reservas/:id', async (request) => {

        const id = Number(request.params.id);

        const index = reservas.findIndex((reserva) => reserva.id === id);

        if (index === -1) {
            return { mensaje: 'reserva no encontrada' };
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

        reservas[index] = {
            id,
            pelicula_id,
            sala_id,
            cantidad_de_entradas,
            precio_total,
            nombre_cliente,
            fecha_reserva,
            hora_reserva
        };

        return reservas[index];
    });

    app.delete<{
        Params: { id: string };
    }>('/reservas/:id', async (request) => {

        const id = Number(request.params.id);

        const index = reservas.findIndex((reserva) => reserva.id === id);

        if (index === -1) {
            return { mensaje: 'reserva no encontrada' };
        }

        reservas.splice(index, 1);

        return { mensaje: 'reserva eliminada' };
    });

}