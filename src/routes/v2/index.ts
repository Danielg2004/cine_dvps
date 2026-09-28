import type { FastifyInstance } from 'fastify';

export async function v2Routes(app: FastifyInstance) {

    app.get('/health', async () => {
        return {
            version: 'v2',
            status: 'ok'
        };
    });

}