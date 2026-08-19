import { buildApp } from './app.js';
import { db } from './database.js';

const app = buildApp();

try {
    await db.query('SELECT 1');
    console.log('Conexion a MySQL exitosa');
} catch (error) {
    console.error('Error al conectar con MySQL:', error);
}

app.listen({ port: 3000 });