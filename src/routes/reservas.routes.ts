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
}