import { buildApp } from './app.js';
import { db, inicializarBaseDeDatos } from './database.js';

const app = buildApp();

try {
    await db.query('SELECT 1');
    console.log('Conexion a MySQL exitosa');

    await inicializarBaseDeDatos();
    console.log('Tablas de la base de datos inicializadas');
} catch (error) {
    console.error('Error al inicializar MySQL:', error);
    process.exit(1);
}

await app.listen({
    port: Number(process.env.PORT ?? 3000),
    host: '0.0.0.0'
});

console.log('Servidor iniciado correctamente');