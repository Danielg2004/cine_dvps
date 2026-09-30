import './observability/instrumentation.js';
import Fastify from 'fastify';
import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';
import { cacheRoutes } from './routes/cache.routes.js';
import { registerCacheObservability } from './observability/http.js';

const app = Fastify({
    logger: true
});

const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (error) => {
    console.error('Error de Redis:', error);
});

// Manejo global de x-trace-id
app.addHook('onRequest', async (request, reply) => {

    const traceHeader = request.headers['x-trace-id'];

    const traceId =
        typeof traceHeader === 'string' && traceHeader.trim() !== ''
            ? traceHeader
            : randomUUID();

    request.headers['x-trace-id'] = traceId;

    reply.header('x-trace-id', traceId);
});

registerCacheObservability(app);

try {

    await redis.connect();
    console.log('Cache Service conectado a Redis');

    // Registrar las rutas del microservicio de cache
    await cacheRoutes(app, redis);

    // Verificar que el microservicio y Redis esten funcionando
    app.get('/health', async (request) => {
        return {
            servicio: 'cache-service',
            estado: 'OK',
            redis: redis.isReady ? 'conectado' : 'desconectado',
            traceId: request.headers['x-trace-id']
        };
    });

    const port = Number(process.env.PORT || 4000);

    await app.listen({
        port,
        host: '0.0.0.0'
    });

    console.log(`Cache Service ejecutandose en el puerto ${port}`);

} catch (error) {

    console.error('Error al iniciar Cache Service:', error);
    process.exit(1);
}