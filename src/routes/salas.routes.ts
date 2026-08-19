import type { FastifyInstance } from 'fastify';
import { salas } from '../data/salas.js';



export async function salasRoutes(app: FastifyInstance) {

    app.get('/salas', async () => {
        return salas;

    });

    app.get<{ Params: { id: string  } }>('/salas/:id', async (request) => {
        const id = Number(request.params.id);
        const sala =salas.find(sala => sala.id ===id);
        return {sala};

    });

    app.post<{
        Body: {
            numero: number;
            capacidad: number;
            hora_de_inicio: string;
            pelicula_id: number;
        }
    }>('/salas', async (request) => {
        const { numero, capacidad, hora_de_inicio, pelicula_id } = request.body;
        const id=salas.length + 1;
        const nuevasala= {id,numero,capacidad,hora_de_inicio,pelicula_id};
        salas.push(nuevasala);
        return nuevasala;


        });


    app.put<{}
    }
    

