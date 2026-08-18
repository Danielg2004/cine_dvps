import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
const app = Fastify();
app.register(peliculasRoutes);










