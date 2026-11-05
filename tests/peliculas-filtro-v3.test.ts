import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { db } from '../src/database.js';
import { peliculasV3Routes } from '../src/routes/v3/peliculas-v3.routes.js';

vi.mock('../src/database.js', () => ({
    db: {
        query: vi.fn()
    }
}));

const peliculas = [
    { id: 1, nombre: 'Avatar', genero: 'Ciencia ficcion' },
    { id: 2, nombre: 'John Wick', genero: 'Accion' },
    { id: 3, nombre: 'Mision Imposible', genero: 'Accion' }
];

describe('Filtro de peliculas por genero V3', () => {

    afterEach(() => {
        vi.clearAllMocks();
    });

    async function crearApp() {
        const app = Fastify();
        await app.register(peliculasV3Routes, { prefix: '/api/v3' });
        await app.ready();
        return app;
    }

    it('filtra peliculas por genero', async () => {
        const query = vi.mocked(db.query);

        query.mockResolvedValueOnce([
            peliculas.filter(p => p.genero === 'Accion')
        ] as any);

        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/peliculas?genero=Accion'
            );

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json()).toHaveLength(2);
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('LOWER(genero) = LOWER(?)'),
                ['Accion']
            );
        } finally {
            await app.close();
        }
    });

    it('acepta el genero en minusculas', async () => {
        const query = vi.mocked(db.query);
        query.mockResolvedValueOnce([[peliculas[1], peliculas[2]]] as any);

        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/peliculas?genero=accion'
            );

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json()).toHaveLength(2);
            expect(query).toHaveBeenCalledWith(
                expect.any(String),
                ['accion']
            );
        } finally {
            await app.close();
        }
    });

    it('devuelve lista vacia si no hay coincidencias', async () => {
        const query = vi.mocked(db.query);
        query.mockResolvedValueOnce([[]] as any);

        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/peliculas?genero=Terror'
            );

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json()).toEqual([]);
        } finally {
            await app.close();
        }
    });

    it('rechaza el genero vacio', async () => {
        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/peliculas?genero='
            );

            expect(respuesta.statusCode).toBe(400);
            expect(respuesta.json().error).toBe(
                'El genero no puede estar vacio'
            );
            expect(db.query).not.toHaveBeenCalled();
        } finally {
            await app.close();
        }
    });

    it('devuelve todas las peliculas sin filtro', async () => {
        const query = vi.mocked(db.query);
        query.mockResolvedValueOnce([peliculas] as any);

        const app = await crearApp();

        try {
            const respuesta = await app.inject('/api/v3/peliculas');

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json()).toHaveLength(3);
            expect(query).toHaveBeenCalledWith(
                'SELECT * FROM peliculas ORDER BY id'
            );
        } finally {
            await app.close();
        }
    });
});
