import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

interface FaultQuery {
    tipo?: string;
}

export async function faultV3Routes(app: FastifyInstance) {

    app.get<{ Querystring: FaultQuery }>(
        '/__test/fault',
        async (request, reply) => {

            const tokenConfigurado = process.env.CANARY_FAULT_TOKEN;
            const tokenRecibido = request.headers['x-canary-test-token'];

            if (
                process.env.APP_TRACK !== 'canary' ||
                !tokenConfigurado ||
                tokenConfigurado.length < 16 ||
                typeof tokenRecibido !== 'string'
            ) {
                return reply.code(404).send({
                    mensaje: 'Ruta no disponible'
                });
            }

            const esperado = Buffer.from(tokenConfigurado);
            const recibido = Buffer.from(tokenRecibido);

            if (
                esperado.length !== recibido.length ||
                !timingSafeEqual(esperado, recibido)
            ) {
                return reply.code(404).send({
                    mensaje: 'Ruta no disponible'
                });
            }

            if (request.query.tipo === 'error') {
                return reply.code(500).send({
                    mensaje: 'Fallo simulado de Canary V4',
                    tipo: 'error'
                });
            }

            if (request.query.tipo === 'latencia') {
                await new Promise(resolve => setTimeout(resolve, 1500));

                return {
                    mensaje: 'Latencia simulada de Canary V4',
                    tipo: 'latencia'
                };
            }

            return reply.code(400).send({
                mensaje: 'Tipo valido: error o latencia'
            });
        }
    );
}
