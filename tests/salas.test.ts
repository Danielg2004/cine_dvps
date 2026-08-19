import { describe, it, expect } from 'vitest';
import { validarSala } from '../src/utils/salas.util.js';

describe('Pruebas unitarias de salas', () => {

    it('debe aceptar una sala con datos correctos', () => {
        const resultado = validarSala({
            numero: 1,
            capacidad: 100,
            hora_de_inicio: '18:00',
            pelicula_id: 1
        });

        expect(resultado).toBe(true);
    });

    it('debe rechazar una sala con numero igual a cero', () => {
        const resultado = validarSala({
            numero: 0,
            capacidad: 100,
            hora_de_inicio: '18:00',
            pelicula_id: 1
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una sala con capacidad igual a cero', () => {
        const resultado = validarSala({
            numero: 1,
            capacidad: 0,
            hora_de_inicio: '18:00',
            pelicula_id: 1
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una sala sin hora de inicio', () => {
        const resultado = validarSala({
            numero: 1,
            capacidad: 100,
            hora_de_inicio: '',
            pelicula_id: 1
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una sala con pelicula_id invalido', () => {
        const resultado = validarSala({
            numero: 1,
            capacidad: 100,
            hora_de_inicio: '18:00',
            pelicula_id: 0
        });

        expect(resultado).toBe(false);
    });

});