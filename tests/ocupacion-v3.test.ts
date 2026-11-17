import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { AppDataSourceV2 } from '../src/config/database-v2.js';
import { ocupacionV3Routes } from '../src/routes/v3/ocupacion-v3.routes.js';

vi.mock('../src/config/database-v2.js', () => ({
    AppDataSourceV2: {
        getRepository: vi.fn()
    }
}));

describe('Estadisticas generales de ocupacion Canary V4', () => {

    afterEach(() => {
        vi.clearAllMocks();
    });

    function simularDatos(salas: unknown[], reservas: unknown[]) {
        const getRepository = vi.mocked(AppDataSourceV2.getRepository);

        getRepository
            .mockReturnValueOnce({
                find: vi.fn().mockResolvedValue(salas)
            } as any)
            .mockReturnValueOnce({
                find: vi.fn().mockResolvedValue(reservas)
            } as any);
    }

    async function crearApp() {
        const app = Fastify();

        await app.register(ocupacionV3Routes, {
            prefix: '/api/v3'
        });

        await app.ready();
        return app;
    }

    it('calcula correctamente la ocupacion general', async () => {

        simularDatos(
            [
                { id: 1, capacidad: 50 },
                { id: 2, capacidad: 100 }
            ],
            [
                { sala_id: 1, cantidad_de_entradas: 20 },
                { sala_id: 2, cantidad_de_entradas: 40 }
            ]
        );

        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/salas/ocupacion?fecha=2026-11-05&hora=18:00'
            );

            expect(respuesta.statusCode).toBe(200);

            expect(respuesta.json()).toMatchObject({
                totalSalas: 2,
                capacidadTotal: 150,
                entradasReservadas: 60,
                cuposDisponibles: 90,
                ocupacionPorcentaje: 40
            });
        } finally {
            await app.close();
        }
    });

    it('devuelve cero ocupacion cuando no hay reservas', async () => {

        simularDatos(
            [{ id: 1, capacidad: 50 }],
            []
        );

        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/salas/ocupacion?fecha=2026-11-05&hora=18:00'
            );

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json().entradasReservadas).toBe(0);
            expect(respuesta.json().cuposDisponibles).toBe(50);
            expect(respuesta.json().ocupacionPorcentaje).toBe(0);
        } finally {
            await app.close();
        }
    });

    it('controla el caso sin salas registradas', async () => {

        simularDatos([], []);

        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/salas/ocupacion?fecha=2026-11-05&hora=18:00'
            );

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.json().totalSalas).toBe(0);
            expect(respuesta.json().ocupacionPorcentaje).toBe(0);
        } finally {
            await app.close();
        }
    });

    it('rechaza solicitudes sin fecha y hora', async () => {

        const app = await crearApp();

        try {
            const respuesta = await app.inject(
                '/api/v3/salas/ocupacion'
            );

            expect(respuesta.statusCode).toBe(400);
            expect(AppDataSourceV2.getRepository).not.toHaveBeenCalled();
        } finally {
            await app.close();
        }
    });
});
