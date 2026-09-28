import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('peliculas')
export class Pelicula {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    nombre!: string;

    @Column({ type: 'int' })
    duracion!: number;

    @Column({ type: 'varchar', length: 100 })
    genero!: string;

    @Column({ type: 'text' })
    descripcion!: string;
}