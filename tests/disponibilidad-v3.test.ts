import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppDataSourceV2 } from '../src/config/database-v2.js';
import { Sala } from '../src/entities/Sala.js';
import { Reserva } from '../src/entities/Reserva.js';

describe('Disponibilidad de salas V3', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rechaza solicitudes sin fecha ni hora', async () => {
        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v3/salas/1/disponibilidad'
            });

            expect(respuesta.statusCode).toBe(400);
        } finally {
            await app.close();
        }
    });

    it('responde 404 cuando la sala no existe', async () => {
        vi.spyOn(AppDataSourceV2, 'getRepository').mockImplementation(
            ((entidad: unknown) => {
                if (entidad === Sala) {
                    return {
                        findOneBy: vi.fn().mockResolvedValue(null)
                    };
                }

                return {
                    find: vi.fn().mockResolvedValue([])
                };
            }) as any
        );

        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v3/salas/999/disponibilidad?fecha=2026-11-05&hora=18:00'
            });

            expect(respuesta.statusCode).toBe(404);
            expect(respuesta.json().mensaje).toBe('Sala no encontrada');
        } finally {
            await app.close();
        }
    });

    it('calcula correctamente los cupos disponibles', async () => {
        vi.spyOn(AppDataSourceV2, 'getRepository').mockImplementation(
            ((entidad: unknown) => {
                if (entidad === Sala) {
                    return {
                        findOneBy: vi.fn().mockResolvedValue({
                            id: 1,
                            numero: 3,
                            capacidad: 80
                        })
                    };
                }

                if (entidad === Reserva) {
                    return {
                        find: vi.fn().mockResolvedValue([
                            { cantidad_de_entradas: 10 },
                            { cantidad_de_entradas: 15 }
                        ])
                    };
                }

                throw new Error('Entidad no esperada');
            }) as any
        );

        const app = buildApp();

        try {
            const respuesta = await app.inject({
                method: 'GET',
                url: '/api/v3/salas/1/disponibilidad?fecha=2026-11-05&hora=18:00'
            });

            expect(respuesta.statusCode).toBe(200);

            const datos = respuesta.json();

            expect(datos.capacidadTotal).toBe(80);
            expect(datos.entradasReservadas).toBe(25);
            expect(datos.cuposDisponibles).toBe(55);
            expect(datos.ocupacionPorcentaje).toBe(31.25);
        } finally {
            await app.close();
        }
    });
});
