export function validarSala(sala: {
    numero: number;
    capacidad: number;
    hora_de_inicio: string;
    pelicula_id: number;
}): boolean {

    if (sala.numero <= 0) {
        return false;
    }

    if (sala.capacidad <= 0) {
        return false;
    }

    if (!sala.hora_de_inicio || sala.hora_de_inicio.trim() === '') {
        return false;
    }

    if (sala.pelicula_id <= 0) {
        return false;
    }

    return true;
}