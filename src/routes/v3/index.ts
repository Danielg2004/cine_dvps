import { faultV3Routes } from './fault-v3.routes.js';
import { ocupacionV3Routes } from './ocupacion-v3.routes.js';
import type { FastifyInstance } from 'fastify';
import { disponibilidadV3Routes } from './disponibilidad-v3.routes.js';
import { peliculasV3Routes } from './peliculas-v3.routes.js';

export async function v3Routes(app: FastifyInstance) {

    app.get('/health', async () => {
        return {
            version: 'v3',
            status: 'ok',
            deployment: 'canary'
        };
    });

    await app.register(disponibilidadV3Routes);
    await app.register(peliculasV3Routes);
    await app.register(ocupacionV3Routes);
    await app.register(faultV3Routes);
}
