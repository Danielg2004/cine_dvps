import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildApp } from '../src/app.js';
import { AppDataSourceV2 } from '../src/config/database-v2.js';
import { Pelicula } from '../src/entities/Pelicula.js';
import * as cacheClient from '../src/clients/cache.client.js';

const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures',
    'pelicula-sintetica.json'
);
const peliculaSintetica = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    id: number;
    nombre: string;
    duracion: number;
    genero: string;
    descripcion: string;
};

describe('Contrato multicloud Sports → Cine', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.CACHE_URL;
    });

    it('responde JSON coherente a una petición simulada desde Sports', async () => {
        vi.spyOn(cacheClient, 'obtenerCache').mockResolvedValue(null);
        vi.spyOn(cacheClient, 'guardarCache').mockResolvedValue(null);
        vi.spyOn(AppDataSourceV2, 'getRepository').mockReturnValue({
            findOneBy: vi.fn().mockResolvedValue(peliculaSintetica),
        } as never);

        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: `/api/v2/peliculas/${peliculaSintetica.id}`,
                headers: {
                    accept: 'application/json',
                    'x-trace-id': 'sports-flow-001',
                    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
                    tracestate: 'congo=t61rcWkgMzE',
                },
            });

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['x-trace-id']).toBe('sports-flow-001');

            const cuerpo = respuesta.json();
            expect(cuerpo.origen).toBe('database');
            expect(cuerpo.traceId).toBe('sports-flow-001');
            expect(cuerpo.pelicula).toEqual(peliculaSintetica);
        } finally {
            await app.close();
        }
    });

    it('devuelve 404 cuando Sports consulta un id inexistente', async () => {
        vi.spyOn(cacheClient, 'obtenerCache').mockResolvedValue(null);
        vi.spyOn(AppDataSourceV2, 'getRepository').mockReturnValue({
            findOneBy: vi.fn().mockResolvedValue(null),
        } as never);

        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/peliculas/999999',
                headers: { 'x-trace-id': 'sports-flow-404' },
            });

            expect(respuesta.statusCode).toBe(404);
            expect(respuesta.json()).toEqual({
                mensaje: 'pelicula no encontrada',
                traceId: 'sports-flow-404',
            });
        } finally {
            await app.close();
        }
    });

    it('devuelve 400 cuando el id no es válido', async () => {
        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v2/peliculas/abc',
                headers: { 'x-trace-id': 'sports-flow-400' },
            });

            expect(respuesta.statusCode).toBe(400);
            expect(respuesta.json().mensaje).toBe('identificador de pelicula invalido');
        } finally {
            await app.close();
        }
    });

    it('degrada a base de datos si el cache falla', async () => {
        vi.spyOn(cacheClient, 'obtenerCache').mockResolvedValue(null);
        vi.spyOn(cacheClient, 'guardarCache').mockResolvedValue(null);
        vi.spyOn(AppDataSourceV2, 'getRepository').mockImplementation(((entidad: unknown) => {
            if (entidad === Pelicula) {
                return {
                    findOneBy: vi.fn().mockResolvedValue(peliculaSintetica),
                };
            }
            throw new Error('entidad inesperada');
        }) as never);

        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: `/api/v2/peliculas/${peliculaSintetica.id}`,
                headers: { 'x-trace-id': 'sports-flow-degrade' },
            });

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json().origen).toBe('database');
        } finally {
            await app.close();
        }
    });
});
