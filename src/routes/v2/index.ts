import type { FastifyInstance } from 'fastify';
import { peliculasV2Routes } from './peliculas-v2.routes.js';

export async function v2Routes(app: FastifyInstance) {

    app.get('/health', async () => {
        return {
            version: 'v2',
            status: 'ok'
        };
    });


    await app.register(peliculasV2Routes);

}