import type { FastifyInstance } from 'fastify';
import { peliculasV2Routes } from './peliculas-v2.routes.js';
import { salasV2Routes } from './salas-v2.routes.js';
import { reservasV2Routes } from './reservas-v2.routes.js';

export async function v2Routes(app: FastifyInstance) {

    app.get('/health', async () => {
        return {
            version: 'v2',
            status: 'ok'
        };
    });

    await app.register(peliculasV2Routes);
    await app.register(salasV2Routes);
    await app.register(reservasV2Routes);

}