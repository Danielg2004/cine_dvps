import {
    type Context,
    type TextMapGetter,
    type TextMapPropagator,
    type TextMapSetter,
} from '@opentelemetry/api';
import {
    CompositePropagator,
    W3CBaggagePropagator,
    W3CTraceContextPropagator,
} from '@opentelemetry/core';

/** Formato W3C Trace Context: version-traceid-spanid-flags */
export const W3C_TRACEPARENT_RE =
    /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i;

/**
 * Sports (u otros proxies) a veces envían `traceparent` duplicado.
 * Node une valores con ", " → el propagador W3C estricto rechaza el header
 * y Cine crea un span ROOT con Trace ID distinto.
 * Tomamos el primer valor W3C válido.
 */
export function firstValidTraceparent(
    value: string | string[] | undefined
): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    const parts = Array.isArray(value)
        ? value.flatMap((item) => item.split(','))
        : value.split(',');
    for (const part of parts) {
        const candidate = part.trim();
        if (W3C_TRACEPARENT_RE.test(candidate)) {
            return candidate.toLowerCase();
        }
    }
    return undefined;
}

export function firstTracestate(
    value: string | string[] | undefined
): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (Array.isArray(value)) {
        const first = value.find((item) => item.trim().length > 0)?.trim();
        return first || undefined;
    }
    const first = value.split(',')[0]?.trim();
    return first || undefined;
}

/**
 * Propagador que normaliza headers duplicados antes de delegar en W3C.
 */
export class SoftW3CTraceContextPropagator implements TextMapPropagator {
    private readonly inner = new W3CTraceContextPropagator();

    inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
        this.inner.inject(context, carrier, setter);
    }

    extract(context: Context, carrier: unknown, getter: TextMapGetter): Context {
        const softGetter: TextMapGetter = {
            keys: (c) => getter.keys(c),
            get: (c, key) => {
                const raw = getter.get(c, key);
                const lower = key.toLowerCase();
                if (lower === 'traceparent') {
                    return firstValidTraceparent(
                        raw as string | string[] | undefined
                    );
                }
                if (lower === 'tracestate') {
                    return firstTracestate(
                        raw as string | string[] | undefined
                    );
                }
                return raw;
            },
        };
        return this.inner.extract(context, carrier, softGetter);
    }

    fields(): string[] {
        return this.inner.fields();
    }
}

export function createCinePropagator(): TextMapPropagator {
    return new CompositePropagator({
        propagators: [
            new SoftW3CTraceContextPropagator(),
            new W3CBaggagePropagator(),
        ],
    });
}
