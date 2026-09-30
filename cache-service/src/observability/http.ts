import { context, trace } from '@opentelemetry/api';
import type { FastifyInstance } from 'fastify';
import { recordCacheResult } from './metrics.js';

function headerString(value: string | string[] | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

export function registerCacheObservability(app: FastifyInstance): void {
    app.addHook('onResponse', async (request, reply) => {
        try {
            const cacheHeader = reply.getHeader('x-cache');
            if (cacheHeader === 'HIT' || cacheHeader === 'MISS') {
                recordCacheResult(cacheHeader);
            }

            const span = trace.getSpan(context.active());
            const spanContext = span?.spanContext();
            const valid = Boolean(spanContext && trace.isSpanContextValid(spanContext));
            const responseTrace = reply.getHeader('x-trace-id');
            const xTraceId = typeof responseTrace === 'string'
                ? responseTrace
                : headerString(request.headers['x-trace-id']);

            request.log.info({
                xTraceId: xTraceId ?? null,
                otelTraceId: valid && spanContext ? spanContext.traceId : null,
                otelSpanId: valid && spanContext ? spanContext.spanId : null,
                traceparent: headerString(request.headers.traceparent) ?? null,
                tracestate: headerString(request.headers.tracestate) ?? null,
            }, 'request.correlation');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'error de observabilidad';
            request.log.error({ error: message }, 'observabilidad');
        }
    });
}
