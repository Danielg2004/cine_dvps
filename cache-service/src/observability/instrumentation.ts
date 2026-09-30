import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterProto } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterProto } from '@opentelemetry/exporter-trace-otlp-proto';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { DiscardSpanExporter, StdoutSpanExporter } from './span-export.js';

const GLOBAL_KEY = '__cacheServiceOpenTelemetryStarted';

function envValue(name: string): string {
    return process.env[name]?.trim() ?? '';
}

function sdkDisabled(): boolean {
    const value = envValue('OTEL_SDK_DISABLED').toLowerCase();
    return value === 'true' || value === '1';
}

function signalProtocol(signal: 'traces' | 'metrics'): string {
    const specific = signal === 'traces'
        ? envValue('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL')
        : envValue('OTEL_EXPORTER_OTLP_METRICS_PROTOCOL');
    return specific || envValue('OTEL_EXPORTER_OTLP_PROTOCOL') || 'http/protobuf';
}

function signalEnabled(signal: 'traces' | 'metrics'): boolean {
    const exporter = signal === 'traces'
        ? envValue('OTEL_TRACES_EXPORTER')
        : envValue('OTEL_METRICS_EXPORTER');
    if (exporter.toLowerCase() === 'none') {
        return false;
    }

    const specific = signal === 'traces'
        ? envValue('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT')
        : envValue('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT');
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
                service: 'cache-service',
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
                service: 'cache-service',
                msg: 'protocolo OTLP de metrics no reconocido; se usa http/protobuf',
            }));
            return new OTLPMetricExporterProto();
    }
}

function startTelemetry(): void {
    const serviceName = envValue('OTEL_SERVICE_NAME') || 'cache-service';

    if (!envValue('OTEL_LOGS_EXPORTER')) {
        process.env.OTEL_LOGS_EXPORTER = 'none';
    }

    if (sdkDisabled()) {
        console.log(JSON.stringify({
            msg: 'OpenTelemetry iniciado',
            service: serviceName,
            otlp: 'disabled',
            sdk: 'disabled',
        }));
        return;
    }

    const exportTraces = signalEnabled('traces');
    const exportMetrics = signalEnabled('metrics');
    const spanProcessors = [];

    if (exportTraces) {
        spanProcessors.push(new BatchSpanProcessor(createTraceExporter()));
    } else {
        spanProcessors.push(new SimpleSpanProcessor(new DiscardSpanExporter()));
    }

    if (envValue('OTEL_SPAN_STDOUT').toLowerCase() === 'true') {
        spanProcessors.push(new SimpleSpanProcessor(new StdoutSpanExporter(serviceName)));
    }

    const sdk = new NodeSDK({
        serviceName,
        instrumentations: [
            new HttpInstrumentation(),
            new FastifyInstrumentation(),
        ],
        spanProcessors,
        metricReaders: [],
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
    }));
}

const globalRecord = globalThis as typeof globalThis & Record<string, boolean | undefined>;
if (!globalRecord[GLOBAL_KEY]) {
    globalRecord[GLOBAL_KEY] = true;
    startTelemetry();
}
