import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
import { salasRoutes } from './routes/salas.routes.js';
import { reservasRoutes } from './routes/reservas.routes.js';

export function buildApp() {

    const app = Fastify();

    app.register(peliculasRoutes);
    app.register(salasRoutes);
    app.register(reservasRoutes);

    return app;
}