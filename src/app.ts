import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
import { salasRoutes } from './routes/salas.routes.js';
import { reservasRoutes } from './routes/reservas.routes.js';
import { v2Routes } from './routes/v2/index.js';
import { registerCineObservability } from './observability/http.js';

export function buildApp() {

    const app = Fastify();

    const version = process.env.APP_VERSION ?? '2.0.0';
    const track = process.env.APP_TRACK ?? 'stable';

    app.addHook('onRequest', async (_request, reply) => {
        reply.header('X-App-Version', version);
        reply.header('X-App-Track', track);
    });

    registerCineObservability(app);

    app.register(peliculasRoutes);
    app.register(salasRoutes);
    app.register(reservasRoutes);


    app.register(v2Routes, { prefix: '/api/v2' });

    return app;
}
