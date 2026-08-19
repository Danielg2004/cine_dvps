import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
import {salasRoutes} from'./routes/salas.routes.js';
const app = Fastify();
app.register(peliculasRoutes);
app.register(salasRoutes);
app.listen({ port: 3000 });








