import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Pelicula } from '../entities/Pelicula.js';
import { Sala } from '../entities/Sala.js';

export const AppDataSourceV2 = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'cine_dvps',

    entities: [
        Pelicula,
        Sala
    ],

    synchronize: false,
    logging: false
});