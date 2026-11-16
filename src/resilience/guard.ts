import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
    applySaturationIfActive,
    SaturationQueueTimeoutError,
} from '../chaos/saturation.js';
import { experimentalAdmission } from './admission.js';
import { experimentalBulkhead } from './bulkhead.js';
import {
    bulkheadEnterTimeoutMs,
    getExperimentRound,
    isProtectedExperimentalPath,
    isResilienceEnabled,
} from './config.js';
import {
    adjustInflight,
    recordRejectedExperimentRequest,
    recordSuccessfulExperimentRequest,
} from './metrics.js';

type GuardState = {
    counted: boolean;
    admissionHeld: boolean;
    releaseBulkhead: (() => void) | null;
};

declare module 'fastify' {
    interface FastifyRequest {
        cineGuard?: GuardState;
    }
}

function sendReject(
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    reason: string
) {
    return reply.code(503).send({
        mensaje: 'solicitud rechazada por control de resiliencia',
        reason,
        round: getExperimentRound(),
    });
}

/**
 * Orden R1: admission → bulkhead → saturación.
 * R0: solo saturación (con tope de cola del mismo mecanismo de fallo).
 */
export function registerResilienceGuard(app: FastifyInstance): void {
    app.addHook('onRequest', async (request, reply) => {
        if (!isProtectedExperimentalPath(request.method, request.url)) {
            return;
        }

        reply.header('x-experiment-round', getExperimentRound());

        if (!isResilienceEnabled()) {
            try {
                await applySaturationIfActive();
            } catch (error) {
                if (error instanceof SaturationQueueTimeoutError) {
                    request.cineGuard = {
                        counted: false,
                        admissionHeld: false,
                        releaseBulkhead: null,
                    };
                    recordRejectedExperimentRequest('saturation_queue_timeout');
                    return sendReject(reply, 'saturation_queue_timeout');
                }
                throw error;
            }

            request.cineGuard = {
                counted: true,
                admissionHeld: false,
                releaseBulkhead: null,
            };
            adjustInflight(1);
            return;
        }

        const admission = experimentalAdmission.tryAdmit();
        if (!admission.ok) {
            request.cineGuard = {
                counted: false,
                admissionHeld: false,
                releaseBulkhead: null,
            };
            return sendReject(reply, admission.reason);
        }

        try {
            const releaseBulkhead = await experimentalBulkhead.enter(bulkheadEnterTimeoutMs());
            request.cineGuard = {
                counted: true,
                admissionHeld: true,
                releaseBulkhead,
            };
            adjustInflight(1);
        } catch {
            experimentalAdmission.release();
            request.cineGuard = {
                counted: false,
                admissionHeld: false,
                releaseBulkhead: null,
            };
            recordRejectedExperimentRequest('bulkhead_timeout');
            return sendReject(reply, 'bulkhead_timeout');
        }

        try {
            await applySaturationIfActive();
        } catch (error) {
            if (error instanceof SaturationQueueTimeoutError) {
                finalizeGuard(request);
                recordRejectedExperimentRequest('saturation_queue_timeout');
                return sendReject(reply, 'saturation_queue_timeout');
            }
            finalizeGuard(request);
            throw error;
        }
    });

    app.addHook('onResponse', async (request, reply) => {
        if (!isProtectedExperimentalPath(request.method, request.url)) {
            return;
        }

        finalizeGuard(request);

        if (reply.statusCode >= 200 && reply.statusCode < 400) {
            recordSuccessfulExperimentRequest();
        } else if (reply.statusCode >= 500 && reply.statusCode !== 503) {
            recordRejectedExperimentRequest('upstream_error');
        }
    });

    app.addHook('onError', async (request) => {
        if (!isProtectedExperimentalPath(request.method, request.url)) {
            return;
        }
        finalizeGuard(request);
    });
}

function finalizeGuard(request: FastifyRequest): void {
    const guard = request.cineGuard;
    if (!guard) {
        return;
    }

    if (guard.releaseBulkhead) {
        guard.releaseBulkhead();
        guard.releaseBulkhead = null;
    }

    if (guard.admissionHeld) {
        experimentalAdmission.release();
        guard.admissionHeld = false;
    }

    if (guard.counted) {
        adjustInflight(-1);
        guard.counted = false;
    }

    delete request.cineGuard;
}
