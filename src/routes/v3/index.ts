import type { FastifyInstance } from 'fastify';
import { disponibilidadV3Routes } from './disponibilidad-v3.routes.js';

export async function v3Routes(app: FastifyInstance) {

    app.get('/health', async () => {
        return {
            version: 'v3',
            status: 'ok',
            deployment: 'canary'
        };
    });

    await app.register(disponibilidadV3Routes);
}
