import type { FastifyInstance } from 'fastify';
import { isChaosControlAuthorized } from '../../chaos/auth.js';
import {
    getSaturationStatus,
    startSaturation,
    stopSaturation,
} from '../../chaos/saturation.js';

interface SaturationBody {
    holdMs?: number;
    maxInflight?: number;
    durationSec?: number;
    maxQueueWaitMs?: number;
}

/**
 * Interruptor propio de saturación controlada (agotamiento de concurrencia).
 * Deshabilitado por defecto: requiere token y activación explícita.
 */
export async function saturationV3Routes(app: FastifyInstance) {
    app.get('/__test/saturation', async (request, reply) => {
        if (!isChaosControlAuthorized(request.headers['x-chaos-token'])) {
            return reply.code(404).send({ mensaje: 'Ruta no disponible' });
        }
        return getSaturationStatus();
    });

    app.post<{ Body: SaturationBody }>('/__test/saturation/start', async (request, reply) => {
        if (!isChaosControlAuthorized(request.headers['x-chaos-token'])) {
            return reply.code(404).send({ mensaje: 'Ruta no disponible' });
        }

        const status = startSaturation(request.body ?? {});
        return reply.code(202).send({
            mensaje: 'saturacion activada',
            status,
        });
    });

    app.post('/__test/saturation/stop', async (request, reply) => {
        if (!isChaosControlAuthorized(request.headers['x-chaos-token'])) {
            return reply.code(404).send({ mensaje: 'Ruta no disponible' });
        }

        const status = stopSaturation('api_stop');
        return {
            mensaje: 'saturacion desactivada',
            status,
        };
    });
}
