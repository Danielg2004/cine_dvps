import { metrics } from '@opentelemetry/api';
import type { Counter, Histogram } from '@opentelemetry/api';

export const HTTP_SERVER_REQUESTS = 'http.server.requests';
export const HTTP_SERVER_ERRORS = 'http.server.errors';
export const HTTP_SERVER_ERRORS_4XX = 'http.server.errors.4xx';
export const HTTP_SERVER_REQUEST_DURATION = 'http.server.request.duration';
export const CINE_RESERVAS_CREADAS = 'cine.reservas.creadas';

const DURATION_BUCKETS = [
    0.005, 0.01, 0.025, 0.05, 0.075, 0.1,
    0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
];

type Instruments = {
    requests: Counter;
    errors: Counter;
    errors4xx: Counter;
    duration: Histogram;
    reservasCreadas: Counter;
};

let instruments: Instruments | undefined;

function getInstruments(): Instruments {
    if (!instruments) {
        const meter = metrics.getMeter('cine-api');

        instruments = {
            requests: meter.createCounter(HTTP_SERVER_REQUESTS, {
                description: 'Count of HTTP server requests',
                unit: '{request}',
            }),

            errors: meter.createCounter(HTTP_SERVER_ERRORS, {
                description: 'Count of HTTP 5xx responses',
                unit: '{error}',
            }),

            errors4xx: meter.createCounter(HTTP_SERVER_ERRORS_4XX, {
                description: 'Count of HTTP 4xx responses',
                unit: '{error}',
            }),

            duration: meter.createHistogram(HTTP_SERVER_REQUEST_DURATION, {
                description: 'Duration of HTTP requests',
                unit: 's',
                advice: {
                    explicitBucketBoundaries: DURATION_BUCKETS,
                },
            }),

            reservasCreadas: meter.createCounter(CINE_RESERVAS_CREADAS, {
                description: 'Count of successfully created reservations',
                unit: '{reservation}',
            }),
        };
    }

    return instruments;
}

function atributosVersion() {
    return {
        'deployment.track': process.env.APP_TRACK ?? 'stable',
        'service.version': process.env.APP_VERSION ?? '2.0.0',
    };
}

export function recordCineHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
}): void {
    const attributes = {
        'http.request.method': input.method,
        'http.route': input.route,
        'http.response.status_code': input.statusCode,
        ...atributosVersion(),
    };

    const current = getInstruments();

    current.requests.add(1, attributes);

    if (input.statusCode >= 500) {
        current.errors.add(1, attributes);
    }

    if (input.statusCode >= 400 && input.statusCode < 500) {
        current.errors4xx.add(1, attributes);
    }

    current.duration.record(input.durationSeconds, attributes);
}

export function recordCineReservaCreada(): void {
    getInstruments().reservasCreadas.add(1, atributosVersion());
}
