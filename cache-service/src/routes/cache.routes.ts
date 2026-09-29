import type { FastifyInstance } from 'fastify';
import type { RedisClientType } from 'redis';

export async function cacheRoutes(
    app: FastifyInstance,
    redis: RedisClientType
) {

    app.post<{
        Body: {
            key: string;
            value: unknown;
            ttl?: number;
        };
    }>('/cache', async (request, reply) => {

        const {
            key,
            value,
            ttl = 60
        } = request.body;

        await redis.set(
            key,
            JSON.stringify(value),
            {
                EX: ttl
            }
        );

        return reply.code(201).send({
            mensaje: 'Dato guardado en cache',
            key,
            ttl
        });
    });
}