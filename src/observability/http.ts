import { context, trace } from '@opentelemetry/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { recordCineHttpRequest } from './metrics.js';

function headerString(value: string | string[] | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function routeTemplate(request: FastifyRequest): string {
    const url = request.routeOptions.url;
    if (typeof url === 'string' && url.length > 0) {
        return url;
    }
    return 'unmatched';
}

export function registerCineObservability(app: FastifyInstance): void {
    app.addHook('onSend', async (request, reply, payload) => {
        const existing = reply.getHeader('x-trace-id');
        if (existing === undefined) {
            const incoming = headerString(request.headers['x-trace-id']);
            if (incoming !== undefined) {
                reply.header('x-trace-id', incoming);
            }
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

            const span = trace.getSpan(context.active());
            const spanContext = span?.spanContext();
            const valid = Boolean(spanContext && trace.isSpanContextValid(spanContext));
            const responseTrace = reply.getHeader('x-trace-id');
            const xTraceId = typeof responseTrace === 'string'
                ? responseTrace
                : headerString(request.headers['x-trace-id']);

            console.log(JSON.stringify({
                service: 'cine-api',
                msg: 'request',
                xTraceId: xTraceId ?? null,
                otelTraceId: valid && spanContext ? spanContext.traceId : null,
                otelSpanId: valid && spanContext ? spanContext.spanId : null,
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
