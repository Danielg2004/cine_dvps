import { context, trace } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

function headerString(value: string | string[] | undefined): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Resuelve el correlacionador de negocio sin romper un trace OTEL existente.
 * Preferencia: x-trace-id entrante → otelTraceId activo → UUID nuevo.
 */
export function resolveBusinessTraceId(request: FastifyRequest): string {
    const incoming = headerString(request.headers['x-trace-id']);
    if (incoming) {
        return incoming;
    }

    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();
    if (spanContext && trace.isSpanContextValid(spanContext)) {
        return spanContext.traceId;
    }

    return randomUUID();
}

export function incomingTraceparent(request: FastifyRequest): string | undefined {
    return headerString(request.headers.traceparent);
}

export function incomingTracestate(request: FastifyRequest): string | undefined {
    return headerString(request.headers.tracestate);
}

export function activeOtelIds(): {
    otelTraceId: string | null;
    otelSpanId: string | null;
} {
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();
    const valid = Boolean(spanContext && trace.isSpanContextValid(spanContext));

    return {
        otelTraceId: valid && spanContext ? spanContext.traceId : null,
        otelSpanId: valid && spanContext ? spanContext.spanId : null,
    };
}
