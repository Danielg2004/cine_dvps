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

app.listen({ port: 3000 });