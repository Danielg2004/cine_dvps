import './observability/instrumentation.js';
import { buildApp } from './app.js';
import { db, inicializarBaseDeDatos } from './database.js';
import { AppDataSourceV2 } from './config/database-v2.js';

const app = buildApp();

try {
  
    await db.query('SELECT 1');
    console.log('Conexion a MySQL exitosa');

 
    await inicializarBaseDeDatos();
    console.log('Tablas de la base de datos inicializadas');


    if (!AppDataSourceV2.isInitialized) {
        await AppDataSourceV2.initialize();
        console.log('Conexion TypeORM V2 exitosa');
    }


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