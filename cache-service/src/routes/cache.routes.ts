import type { FastifyInstance } from 'fastify';
import type { RedisClientType } from 'redis';

export async function cacheRoutes(
    app: FastifyInstance,
    redis: RedisClientType
) {

    // Guardar un dato en cache con TTL
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


    // Consultar un dato almacenado en cache
    app.get<{
        Params: {
            key: string;
        };
    }>('/cache/:key', async (request, reply) => {

        const { key } = request.params;

        const value = await redis.get(key);

        // MISS: la clave no existe o ya expiro
        if (value === null) {

            reply.header('x-cache', 'MISS');

            return reply.code(404).send({
                cache: 'MISS',
                key,
                mensaje: 'Dato no encontrado en cache'
            });
        }

        // HIT: encontramos el dato en Redis
        reply.header('x-cache', 'HIT');

        return reply.code(200).send({
            cache: 'HIT',
            key,
            value: JSON.parse(value)
        });
    });
}