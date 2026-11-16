import type { FastifyInstance, FastifyRequest } from 'fastify';
import { applySaturationIfActive } from '../chaos/saturation.js';
import { experimentalAdmission } from './admission.js';
import { experimentalBulkhead } from './bulkhead.js';
import {
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

export function registerResilienceGuard(app: FastifyInstance): void {
    app.addHook('onRequest', async (request, reply) => {
        if (!isProtectedExperimentalPath(request.method, request.url)) {
            return;
        }

        reply.header('x-experiment-round', getExperimentRound());

        await applySaturationIfActive();

        if (!isResilienceEnabled()) {
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
            return reply.code(503).send({
                mensaje: 'solicitud rechazada por control de admision',
                reason: admission.reason,
                round: getExperimentRound(),
            });
        }

        try {
            const releaseBulkhead = await experimentalBulkhead.enter();
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
            return reply.code(503).send({
                mensaje: 'solicitud rechazada por bulkhead saturado',
                reason: 'bulkhead_timeout',
                round: getExperimentRound(),
            });
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
