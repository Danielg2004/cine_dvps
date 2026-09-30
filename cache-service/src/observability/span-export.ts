import { ExportResultCode } from '@opentelemetry/core';
import type { ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

const SPAN_KIND = ['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'] as const;

export class DiscardSpanExporter implements SpanExporter {
    export(_spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
        resultCallback({ code: ExportResultCode.SUCCESS });
    }

    shutdown(): Promise<void> {
        return Promise.resolve();
    }
}

export class StdoutSpanExporter implements SpanExporter {
    constructor(private readonly serviceName: string) {}

    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
        for (const span of spans) {
            const spanContext = span.spanContext();
            const route = span.attributes['http.route'];
            const payload: {
                service: string;
                traceId: string;
                spanId: string;
                parentSpanId: string | null;
                kind: string;
                name: string;
                route?: string;
            } = {
                service: this.serviceName,
                traceId: spanContext.traceId,
                spanId: spanContext.spanId,
                parentSpanId: span.parentSpanContext?.spanId ?? null,
                kind: SPAN_KIND[span.kind] ?? String(span.kind),
                name: span.name,
            };

            if (typeof route === 'string') {
                payload.route = route;
            }

            process.stdout.write(`OTEL_SPAN ${JSON.stringify(payload)}\n`);
        }

        resultCallback({ code: ExportResultCode.SUCCESS });
    }

    shutdown(): Promise<void> {
        return Promise.resolve();
    }
}
