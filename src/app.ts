import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
import { salasRoutes } from './routes/salas.routes.js';
import { reservasRoutes } from './routes/reservas.routes.js';
import { v2Routes } from './routes/v2/index.js';

export function buildApp() {

    const app = Fastify();

    
    app.register(peliculasRoutes);
    app.register(salasRoutes);
    app.register(reservasRoutes);


    app.register(v2Routes, { prefix: '/api/v2' });

    return app;
}