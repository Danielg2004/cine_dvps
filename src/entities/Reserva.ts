import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('reservas')
export class Reserva {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    pelicula_id!: number;

    @Column({ type: 'int' })
    sala_id!: number;

    @Column({ type: 'int' })
    cantidad_de_entradas!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    precio_total!: number;

    @Column({ type: 'varchar', length: 255 })
    nombre_cliente!: string;

    @Column({ type: 'date' })
    fecha_reserva!: string;

    @Column({ type: 'time' })
    hora_reserva!: string;
}