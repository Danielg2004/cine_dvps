import Fastify from 'fastify';
import { createClient } from 'redis';

const app = Fastify({
    logger: true
});

const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (error) => {
    console.error('Error de Redis:', error);
});

try {

    await redis.connect();
    console.log('Cache Service conectado a Redis');

    app.get('/health', async () => {
        return {
            servicio: 'cache-service',
            estado: 'OK',
            redis: redis.isReady ? 'conectado' : 'desconectado'
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