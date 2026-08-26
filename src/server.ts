import { buildApp } from './app.js';
import { db, inicializarBaseDeDatos } from './database.js';

const app = buildApp();

try {
    // Comprobar conexión con MySQL
    await db.query('SELECT 1');
    console.log('Conexion a MySQL exitosa');

    // Crear las tablas si todavía no existen
    await inicializarBaseDeDatos();
    console.log('Tablas de la base de datos inicializadas');

    // Iniciar Fastify
    const port = Number(process.env.PORT ?? 3000);

    await app.listen({
        port,
        host: '0.0.0.0'
    });

    console.log(`Servidor iniciado correctamente en el puerto ${port}`);

} catch (error) {
    console.error('Error al iniciar la aplicacion:', error);
    process.exit(1);
}