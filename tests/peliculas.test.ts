import { describe, it, expect } from 'vitest';
import { validarPelicula } from '../src/utils/peliculas.util.js';

describe('Pruebas unitarias de películas', () => {

    it('debe aceptar una película con datos correctos', () => {
        const resultado = validarPelicula({
            nombre: 'Spider-Man',
            duracion: 180,
            genero: 'Acción',
            descripcion: 'Película de Marvel'
        });

        expect(resultado).toBe(true);
    });

    it('debe rechazar una película sin nombre', () => {
        const resultado = validarPelicula({
            nombre: '',
            duracion: 180,
            genero: 'Acción'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una película con duración igual a cero', () => {
        const resultado = validarPelicula({
            nombre: 'Spider-Man',
            duracion: 0,
            genero: 'Acción'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una película con duración negativa', () => {
        const resultado = validarPelicula({
            nombre: 'Spider-Man',
            duracion: -10,
            genero: 'Acción'
        });

        expect(resultado).toBe(false);
    });

    it('debe rechazar una película sin género', () => {
        const resultado = validarPelicula({
            nombre: 'Spider-Man',
            duracion: 180,
            genero: ''
        });

        expect(resultado).toBe(false);
    });

});