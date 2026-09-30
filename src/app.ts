import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
import { salasRoutes } from './routes/salas.routes.js';
import { reservasRoutes } from './routes/reservas.routes.js';
import { v2Routes } from './routes/v2/index.js';
import { registerCineObservability } from './observability/http.js';

export function buildApp() {

    const app = Fastify();

    registerCineObservability(app);

    app.register(peliculasRoutes);
    app.register(salasRoutes);
    app.register(reservasRoutes);


    app.register(v2Routes, { prefix: '/api/v2' });

    return app;
}