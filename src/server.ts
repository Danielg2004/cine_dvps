import Fastify from 'fastify';
const app = Fastify();

const peliculas = [
  {
    id: 1,
    nombre: "SPIDER-MAN-BRAND-NEW-DAY",
    duracion: 180,
    genero: "ciencia ficcion",
    descripcion: "pelicula de marvel"
  }
];

app.get('/peliculas', async () => {
  return { peliculas };
});



app.get<{ Params: { id: string } }>('/peliculas/:id', async (request) => {
    const id = Number(request.params.id);
    const pelicula =peliculas.find((pelicula)=>pelicula.id ===id);
    return {pelicula};

});

app.post<{
    Body: {
        nombre: string;
        duracion: number;
        genero: string;
        descripcion: string;
    }
}>('/peliculas', async (request) => {

    const { nombre, duracion, genero, descripcion } = request.body;
    const id=peliculas.length + 1;
    const nuevapelicula= {id,nombre,duracion,genero,descripcion};
    peliculas.push(nuevapelicula);
    return nuevapelicula;
});

app.put<{
    Params: { id: string };
    Body: {
        nombre: string;
        duracion: number;
        genero: string;
        descripcion: string;
    };
}>('/peliculas/:id', async (request) => {

    const id = Number(request.params.id);

    const index = peliculas.findIndex((pelicula) => pelicula.id === id);

    if (index === -1) {
        return { mensaje: 'pelicula no encontrada' };
    }

    const { nombre, duracion, genero, descripcion } = request.body;
    peliculas[index] = { id, nombre, duracion, genero, descripcion };
    return peliculas[index];

});

app.delete<{
    Params: { id: string };
}>('/peliculas/:id', async (request) => {

    const id = Number(request.params.id);

    const index = peliculas.findIndex((pelicula) => pelicula.id === id);

    if (index === -1) {
        return { mensaje: 'pelicula no encontrada' };
    }

    peliculas.splice(index, 1);

    return { mensaje: 'pelicula eliminada' };
});
app.listen({ port: 3000 });