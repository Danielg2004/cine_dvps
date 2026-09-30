import { buildApp } from '../../src/app.js';

const port = Number(process.env.PORT);

if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT requerido');
}

if (!process.env.CACHE_URL) {
    throw new Error('CACHE_URL requerido');
}

const app = buildApp();

await app.listen({
    port,
    host: '127.0.0.1',
});

console.log(`HARNESS_READY cine ${port}`);
