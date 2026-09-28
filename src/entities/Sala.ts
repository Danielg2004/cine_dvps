import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('salas')
export class Sala {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    numero!: number;

    @Column({ type: 'int' })
    capacidad!: number;

    @Column({ type: 'time' })
    hora_de_inicio!: string;

    @Column({ type: 'int' })
    pelicula_id!: number;
}