import type { FastifyInstance } from 'fastify';
import { db } from '../database.js';

/**
 * Liveness: proceso vivo. No comprueba dependencias externas.
 * Readiness: puede recibir tráfico; comprueba MySQL de forma ligera.
 */
export async function healthRoutes(app: FastifyInstance) {
    app.get('/healthz', async () => ({
        status: 'ok',
        probe: 'liveness',
    }));

    app.get('/readyz', async (_request, reply) => {
        try {
            await db.query('SELECT 1');
            return {
                status: 'ready',
                probe: 'readiness',
                database: 'up',
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'db_error';
            return reply.code(503).send({
                status: 'not_ready',
                probe: 'readiness',
                database: 'down',
                error: message,
            });
        }
    });
}
