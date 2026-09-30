import { metrics } from '@opentelemetry/api';
import {
    AggregationTemporality,
    DataPointType,
    InMemoryMetricExporter,
    MeterProvider,
    PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import type { ResourceMetrics } from '@opentelemetry/sdk-metrics';

export function installInMemoryMetrics() {
    const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    const reader = new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 60_000,
    });
    const provider = new MeterProvider({
        readers: [reader],
    });
    metrics.setGlobalMeterProvider(provider);

    return {
        async collect(): Promise<ResourceMetrics[]> {
            await provider.forceFlush();
            return exporter.getMetrics();
        },
    };
}

function lastSnapshot(collected: ResourceMetrics[]): ResourceMetrics | undefined {
    return collected.at(-1);
}

export function sumCounter(
    collected: ResourceMetrics[],
    name: string,
    predicate?: (attributes: Record<string, unknown>) => boolean,
): number {
    const snapshot = lastSnapshot(collected);
    if (!snapshot) {
        return 0;
    }

    let total = 0;
    for (const scope of snapshot.scopeMetrics) {
        for (const metric of scope.metrics) {
            if (metric.descriptor.name !== name || metric.dataPointType !== DataPointType.SUM) {
                continue;
            }
            for (const point of metric.dataPoints) {
                const attributes = point.attributes as Record<string, unknown>;
                if (predicate && !predicate(attributes)) {
                    continue;
                }
                if (typeof point.value === 'number') {
                    total += point.value;
                }
            }
        }
    }
    return total;
}

export function histogramCount(
    collected: ResourceMetrics[],
    name: string,
    predicate?: (attributes: Record<string, unknown>) => boolean,
): number {
    const snapshot = lastSnapshot(collected);
    if (!snapshot) {
        return 0;
    }

    let total = 0;
    for (const scope of snapshot.scopeMetrics) {
        for (const metric of scope.metrics) {
            if (metric.descriptor.name !== name || metric.dataPointType !== DataPointType.HISTOGRAM) {
                continue;
            }
            for (const point of metric.dataPoints) {
                const attributes = point.attributes as Record<string, unknown>;
                if (predicate && !predicate(attributes)) {
                    continue;
                }
                if (typeof point.value === 'object' && point.value && 'count' in point.value) {
                    total += point.value.count;
                }
            }
        }
    }
    return total;
}

export function attributeSets(
    collected: ResourceMetrics[],
    name: string,
): Array<Record<string, unknown>> {
    const snapshot = lastSnapshot(collected);
    if (!snapshot) {
        return [];
    }

    const sets: Array<Record<string, unknown>> = [];
    for (const scope of snapshot.scopeMetrics) {
        for (const metric of scope.metrics) {
            if (metric.descriptor.name !== name) {
                continue;
            }
            for (const point of metric.dataPoints) {
                sets.push(point.attributes as Record<string, unknown>);
            }
        }
    }
    return sets;
}
