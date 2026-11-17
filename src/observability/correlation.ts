import { context, trace } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { firstTracestate, firstValidTraceparent } from './w3c-propagator.js';

function headerString(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
        const first = value.find((item) => typeof item === 'string' && item.length > 0);
        return first;
    }
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Resuelve el correlacionador de negocio sin romper un trace OTEL existente.
 * Preferencia: x-trace-id entrante → otelTraceId activo → UUID nuevo.
 * Nunca usa x-trace-id textual arbitrario como Trace ID OTel.
 */
export function resolveBusinessTraceId(request: FastifyRequest): string {
    const incoming = headerString(request.headers['x-trace-id']);
    if (incoming) {
        // Si llegaron varios x-trace-id unidos, conservar el primero.
        return incoming.split(',')[0]?.trim() || incoming;
    }

    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();
    if (spanContext && trace.isSpanContextValid(spanContext)) {
        return spanContext.traceId;
    }

    return randomUUID();
}

export function incomingTraceparent(request: FastifyRequest): string | undefined {
    return firstValidTraceparent(request.headers.traceparent);
}

export function incomingTracestate(request: FastifyRequest): string | undefined {
    return firstTracestate(request.headers.tracestate);
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
