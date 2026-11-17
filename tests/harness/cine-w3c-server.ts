/**
 * Harness HTTP real (no light-my-request) para validar extracción W3C
 * vía HttpInstrumentation sobre IncomingMessage.
 */
import { buildApp } from '../../src/app.js';

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT requerido');
}

// Evitar dependencia de MySQL/cache en esta prueba de propagación.
process.env.DB_AUTO_INIT = 'false';

const app = buildApp();

// Ruta mínima ya cubierta por /healthz (sin DB). buildApp registra healthRoutes.
await app.listen({
    port,
    host: '127.0.0.1',
});

console.log(`HARNESS_READY cine-w3c ${port}`);
