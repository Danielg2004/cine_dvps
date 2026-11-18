import { accessSync, constants as fsConstants } from 'node:fs';
import { metrics, propagation } from '@opentelemetry/api';
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterProto } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterProto } from '@opentelemetry/exporter-trace-otlp-proto';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import { DiscardSpanExporter, StdoutSpanExporter } from './span-export.js';
import { createCinePropagator } from './w3c-propagator.js';
import { startTelemetryHeartbeat } from './heartbeat.js';
import { isOtelMetricsExportEnabled, isOtelSdkDisabled } from './otel-export-state.js';

const GLOBAL_KEY = '__cineApiOpenTelemetryStarted';

function envValue(name: string): string {
    return process.env[name]?.trim() ?? '';
}

function signalProtocol(signal: 'traces' | 'metrics'): string {
    const specific = signal === 'traces'
        ? envValue('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL')
        : envValue('OTEL_EXPORTER_OTLP_METRICS_PROTOCOL');
    return specific || envValue('OTEL_EXPORTER_OTLP_PROTOCOL') || 'http/protobuf';
}

function signalEnabled(signal: 'traces' | 'metrics'): boolean {
    if (signal === 'metrics') {
        return isOtelMetricsExportEnabled();
    }
    const exporter = envValue('OTEL_TRACES_EXPORTER');
    if (exporter.toLowerCase() === 'none') {
        return false;
    }

    const specific = envValue('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT');
    return Boolean(specific || envValue('OTEL_EXPORTER_OTLP_ENDPOINT'));
}

function createTraceExporter(): SpanExporter {
    switch (signalProtocol('traces')) {
        case 'grpc':
            return new OTLPTraceExporterGrpc();
        case 'http/json':
            return new OTLPTraceExporterHttp();
        case 'http/protobuf':
            return new OTLPTraceExporterProto();
        default:
            console.error(JSON.stringify({
                service: 'cine-api',
                msg: 'protocolo OTLP de traces no reconocido; se usa http/protobuf',
            }));
            return new OTLPTraceExporterProto();
    }
}

function createMetricExporter(): PushMetricExporter {
    switch (signalProtocol('metrics')) {
        case 'grpc':
            return new OTLPMetricExporterGrpc();
        case 'http/json':
            return new OTLPMetricExporterHttp();
        case 'http/protobuf':
            return new OTLPMetricExporterProto();
        default:
            console.error(JSON.stringify({
                service: 'cine-api',
                msg: 'protocolo OTLP de metrics no reconocido; se usa http/protobuf',
            }));
            return new OTLPMetricExporterProto();
    }
}

function certDiagnostics(): { certificateConfigured: boolean; certificateReadable: boolean } {
    const certPath = envValue('OTEL_EXPORTER_OTLP_CERTIFICATE');
    if (!certPath) {
        return { certificateConfigured: false, certificateReadable: false };
    }
    try {
        // Solo comprueba existencia/lectura; el exporter OTLP vuelve a leer el CA.
        accessSync(certPath, fsConstants.R_OK);
        return { certificateConfigured: true, certificateReadable: true };
    } catch {
        return { certificateConfigured: true, certificateReadable: false };
    }
}

function endpointHost(): string | null {
    const raw = envValue('OTEL_EXPORTER_OTLP_ENDPOINT')
        || envValue('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT')
        || envValue('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT');
    if (!raw) {
        return null;
    }
    try {
        return new URL(raw).host;
    } catch {
        return 'invalid-url';
    }
}

function startTelemetry(): void {
    const serviceName = envValue('OTEL_SERVICE_NAME') || 'cine-api';

    if (!envValue('OTEL_LOGS_EXPORTER')) {
        process.env.OTEL_LOGS_EXPORTER = 'none';
    }

    if (isOtelSdkDisabled()) {
        console.log(JSON.stringify({
            msg: 'OpenTelemetry iniciado',
            service: serviceName,
            otlp: 'disabled',
            sdk: 'disabled',
        }));
        // Heartbeat puede arrancar igual; el puente local no espeja si export métricas=off.
        startTelemetryHeartbeat();
        return;
    }

    const exportTraces = signalEnabled('traces');
    const exportMetrics = signalEnabled('metrics');
    const spanProcessors = [];
    const cert = certDiagnostics();
    const headersConfigured = Boolean(
        envValue('OTEL_EXPORTER_OTLP_HEADERS')
        || envValue('OTEL_EXPORTER_OTLP_TRACES_HEADERS')
        || envValue('OTEL_EXPORTER_OTLP_METRICS_HEADERS')
    );

    if (exportTraces) {
        spanProcessors.push(new BatchSpanProcessor(createTraceExporter()));
    } else {
        spanProcessors.push(new SimpleSpanProcessor(new DiscardSpanExporter()));
    }

    if (envValue('OTEL_SPAN_STDOUT').toLowerCase() === 'true') {
        spanProcessors.push(new SimpleSpanProcessor(new StdoutSpanExporter(serviceName)));
    }

    const textMapPropagator = createCinePropagator();
    // Asegurar propagador antes de instrumentar HTTP (extracción en SERVER span).
    propagation.setGlobalPropagator(textMapPropagator);

    const instrumentations = [
        new HttpInstrumentation(),
        new FastifyInstrumentation(),
        new UndiciInstrumentation(),
    ];

    const sdk = new NodeSDK({
        serviceName,
        instrumentations,
        spanProcessors,
        metricReaders: [],
        textMapPropagator,
    });
    sdk.start();

    if (exportMetrics) {
        const resource = defaultResource().merge(resourceFromAttributes({
            'service.name': serviceName,
        }));
        metrics.setGlobalMeterProvider(new MeterProvider({
            resource,
            readers: [
                new PeriodicExportingMetricReader({
                    exporter: createMetricExporter(),
                }),
            ],
        }));
    }

    console.log(JSON.stringify({
        msg: 'OpenTelemetry iniciado',
        service: serviceName,
        otlp: exportTraces || exportMetrics ? 'configured' : 'disabled',
        traces: exportTraces,
        metrics: exportMetrics,
        protocol: signalProtocol(exportTraces ? 'traces' : 'metrics'),
        endpointHost: endpointHost(),
        headersConfigured,
        certificateConfigured: cert.certificateConfigured,
        certificateReadable: cert.certificateReadable,
        // W3C + soft-parse de traceparent duplicados (Sports double-inject)
        propagator: 'w3c-soft-traceparent',
    }));

    startTelemetryHeartbeat();
}

const globalRecord = globalThis as typeof globalThis & Record<string, boolean | undefined>;
if (!globalRecord[GLOBAL_KEY]) {
    globalRecord[GLOBAL_KEY] = true;
    startTelemetry();
}
