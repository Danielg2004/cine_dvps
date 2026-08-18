import Fastify from 'fastify';
const app = Fastify();

app.get('/peliculas', async () => {
  return { mensaje: 'peliculas de cine ' };
});

app.listen({ port: 3000 });
