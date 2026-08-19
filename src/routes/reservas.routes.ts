import type { FastifyInstance } from 'fastify';
import { reservas } from '../data/reserva.js';

export async function reservasRoutes(app: FastifyInstance) {

  app.get('/reservas', async () => {
    return reservas;
  });

  app.get<{ Params: { id: string } }>('/reservas/:id', async (request) => {
    const id = Number(request.params.id);
    const reserva =reservas.find((reserva)=>reserva.id ===id);
    return {reserva};

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
}