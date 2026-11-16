import type { FastifyInstance, FastifyRequest } from 'fastify';
import { recordCineHttpRequest } from './metrics.js';
import {
    activeOtelIds,
    incomingTraceparent,
    incomingTracestate,
    resolveBusinessTraceId,
} from './correlation.js';

function routeTemplate(request: FastifyRequest): string {
    const url = request.routeOptions.url;
    if (typeof url === 'string' && url.length > 0) {
        return url;
    }
    return 'unmatched';
}

export function registerCineObservability(app: FastifyInstance): void {
    app.addHook('onRequest', async (request, reply) => {
        const businessTraceId = resolveBusinessTraceId(request);
        request.headers['x-trace-id'] = businessTraceId;
        reply.header('x-trace-id', businessTraceId);

        const traceparent = incomingTraceparent(request);
        if (traceparent) {
            reply.header('traceparent', traceparent);
        }

        const tracestate = incomingTracestate(request);
        if (tracestate) {
            reply.header('tracestate', tracestate);
        }
    });

    app.addHook('onSend', async (request, reply, payload) => {
        if (reply.getHeader('x-trace-id') === undefined) {
            reply.header('x-trace-id', resolveBusinessTraceId(request));
        }
        return payload;
    });

    app.addHook('onResponse', async (request, reply) => {
        try {
            const route = routeTemplate(request);
            const statusCode = reply.statusCode;
            recordCineHttpRequest({
                method: request.method,
                route,
                statusCode,
                durationSeconds: reply.elapsedTime / 1000,
            });

            const { otelTraceId, otelSpanId } = activeOtelIds();
            const responseTrace = reply.getHeader('x-trace-id');
            const xTraceId = typeof responseTrace === 'string'
                ? responseTrace
                : resolveBusinessTraceId(request);

            console.log(JSON.stringify({
                service: 'cine-api',
                msg: statusCode >= 500 ? 'request_error' : 'request',
                xTraceId,
                otelTraceId,
                otelSpanId,
                traceparent: incomingTraceparent(request) ?? null,
                tracestate: incomingTracestate(request) ?? null,
                'http.request.method': request.method,
                'http.route': route,
                'http.response.status_code': statusCode,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'error de observabilidad';
            console.error(JSON.stringify({
                service: 'cine-api',
                msg: 'observabilidad',
                error: message,
            }));
        }
    });
}
