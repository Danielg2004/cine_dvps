import Fastify from 'fastify';
import { peliculasRoutes } from './routes/peliculas.routes.js';
import { salasRoutes } from './routes/salas.routes.js';
import { reservasRoutes } from './routes/reservas.routes.js';
import { db } from './database.js';

const app = Fastify();

try {
    const [resultado] = await db.query('SELECT 1');
    console.log('Conexion a MySQL exitosa');
} catch (error) {
    console.error('Error al conectar con MySQL:', error);
}

app.register(peliculasRoutes);
app.register(salasRoutes);
app.register(reservasRoutes);

app.listen({ port: 3000 });