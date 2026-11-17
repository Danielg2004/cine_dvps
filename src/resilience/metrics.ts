import { metrics } from '@opentelemetry/api';
import type { Counter, UpDownCounter } from '@opentelemetry/api';
import { getExperimentRound } from './config.js';

const METER = 'cine-api-resilience';

let instruments: {
    successful: Counter;
    rejected: Counter;
    bulkheadActive: UpDownCounter;
    admissionRejects: Counter;
    inflight: UpDownCounter;
    saturationActive: UpDownCounter;
} | undefined;

function getInstruments() {
    if (!instruments) {
        const meter = metrics.getMeter(METER);
        instruments = {
            successful: meter.createCounter('cine.experiment.requests.successful', {
                unit: '{request}',
                description: 'Successful responses on experimental surface',
            }),
            rejected: meter.createCounter('cine.experiment.requests.rejected', {
                unit: '{request}',
                description: 'Rejected or failed experimental requests',
            }),
            bulkheadActive: meter.createUpDownCounter('cine.experiment.bulkhead.active', {
                unit: '{request}',
                description: 'Requests inside bulkhead critical section',
            }),
            admissionRejects: meter.createCounter('cine.experiment.admission.rejected', {
                unit: '{request}',
                description: 'Requests rejected by admission control',
            }),
            inflight: meter.createUpDownCounter('cine.experiment.inflight', {
                unit: '{request}',
                description: 'In-flight experimental requests',
            }),
            saturationActive: meter.createUpDownCounter('cine.experiment.saturation.active', {
                unit: '{session}',
                description: 'Saturation fault sessions active',
            }),
        };
    }
    return instruments;
}

function baseAttrs(extra: Record<string, string> = {}) {
    return {
        'experiment.round': getExperimentRound(),
        ...extra,
    };
}

export function recordSuccessfulExperimentRequest(): void {
    getInstruments().successful.add(1, baseAttrs());
}

export function recordRejectedExperimentRequest(reason: string): void {
    getInstruments().rejected.add(1, baseAttrs({ reason }));
}

export function recordAdmissionReject(reason: string): void {
    const attrs = baseAttrs({ reason });
    getInstruments().admissionRejects.add(1, attrs);
    getInstruments().rejected.add(1, attrs);
}

export function adjustBulkheadActive(delta: number): void {
    getInstruments().bulkheadActive.add(delta, baseAttrs());
}

export function adjustInflight(delta: number): void {
    getInstruments().inflight.add(delta, baseAttrs());
}

export function adjustSaturationActive(delta: number): void {
    getInstruments().saturationActive.add(delta, baseAttrs());
}
