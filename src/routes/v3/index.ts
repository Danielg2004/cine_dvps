import type { FastifyInstance } from 'fastify';

export async function v3Routes(app: FastifyInstance) {

    app.get('/health', async () => {
        return {
            version: 'v3',
            status: 'ok',
            deployment: 'canary'
        };
    });

}
