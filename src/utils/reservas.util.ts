export function validarReserva(reserva: {
    pelicula_id: number;
    sala_id: number;
    cantidad_de_entradas: number;
    precio_total: number;
    nombre_cliente: string;
    fecha_reserva: string;
    hora_reserva: string;
}): boolean {

    if (reserva.pelicula_id <= 0) {
        return false;
    }

    if (reserva.sala_id <= 0) {
        return false;
    }

    if (reserva.cantidad_de_entradas <= 0) {
        return false;
    }

    if (reserva.precio_total <= 0) {
        return false;
    }

    if (!reserva.nombre_cliente || reserva.nombre_cliente.trim() === '') {
        return false;
    }

    if (!reserva.fecha_reserva || reserva.fecha_reserva.trim() === '') {
        return false;
    }

    if (!reserva.hora_reserva || reserva.hora_reserva.trim() === '') {
        return false;
    }

    return true;
}