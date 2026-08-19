export function validarPelicula(pelicula: {
    nombre: string;
    duracion: number;
    genero: string;
    descripcion?: string;
}): boolean {

    if (!pelicula.nombre || pelicula.nombre.trim() === '') {
        return false;
    }

    if (pelicula.duracion <= 0) {
        return false;
    }

    if (!pelicula.genero || pelicula.genero.trim() === '') {
        return false;
    }

    return true;
}