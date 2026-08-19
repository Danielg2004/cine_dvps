import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
import {salasRoutes} from'./routes/salas.routes.js';
import { reservasRoutes } from './routes/reservas.routes.js';
const app = Fastify();
app.register(peliculasRoutes);
app.register(salasRoutes);
app.register(reservasRoutes);
app.listen({ port: 3000 });








