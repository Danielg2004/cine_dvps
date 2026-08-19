import { describe, it, expect } from 'vitest';
import { validarReserva } from '../src/utils/reservas.util.js';

describe('Pruebas unitarias de reservas', () => {

    it('debe aceptar una reserva con datos correctos', () => {
        const resultado = validarReserva({
            pelicula_id: 1,
            sala_id: 1,
            cantidad_de_entradas: 2,
            precio_total: 30000,
            nombre_cliente: 'Samuel',
            fecha_reserva: '2026-08-19',
            hora_reserva: '18:00'
        });

        expect(resultado).toBe(true);
    });

    it('debe rechazar una reserva con pelicula_id invalido', () => {
        const resultado = validarReserva({
            pelicula_id: 0,
            sala_id: 1,
            cantidad_de_entradas: 2,
            precio_total: 30000,
            nombre_cliente: 'Samuel',
            fecha_reserva: '2026-08-19',
            hora_reserva: '18:00'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una reserva con sala_id invalido', () => {
        const resultado = validarReserva({
            pelicula_id: 1,
            sala_id: 0,
            cantidad_de_entradas: 2,
            precio_total: 30000,
            nombre_cliente: 'Samuel',
            fecha_reserva: '2026-08-19',
            hora_reserva: '18:00'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una reserva sin entradas', () => {
        const resultado = validarReserva({
            pelicula_id: 1,
            sala_id: 1,
            cantidad_de_entradas: 0,
            precio_total: 30000,
            nombre_cliente: 'Samuel',
            fecha_reserva: '2026-08-19',
            hora_reserva: '18:00'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una reserva con precio invalido', () => {
        const resultado = validarReserva({
            pelicula_id: 1,
            sala_id: 1,
            cantidad_de_entradas: 2,
            precio_total: 0,
            nombre_cliente: 'Samuel',
            fecha_reserva: '2026-08-19',
            hora_reserva: '18:00'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una reserva sin nombre del cliente', () => {
        const resultado = validarReserva({
            pelicula_id: 1,
            sala_id: 1,
            cantidad_de_entradas: 2,
            precio_total: 30000,
            nombre_cliente: '',
            fecha_reserva: '2026-08-19',
            hora_reserva: '18:00'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una reserva sin fecha', () => {
        const resultado = validarReserva({
            pelicula_id: 1,
            sala_id: 1,
            cantidad_de_entradas: 2,
            precio_total: 30000,
            nombre_cliente: 'Samuel',
            fecha_reserva: '',
            hora_reserva: '18:00'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una reserva sin hora', () => {
        const resultado = validarReserva({
            pelicula_id: 1,
            sala_id: 1,
            cantidad_de_entradas: 2,
            precio_total: 30000,
            nombre_cliente: 'Samuel',
            fecha_reserva: '2026-08-19',
            hora_reserva: ''
        });

        expect(resultado).toBe(false);
    });

});