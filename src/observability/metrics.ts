import { metrics } from '@opentelemetry/api';
import type { Counter, Histogram } from '@opentelemetry/api';

export const HTTP_SERVER_REQUESTS = 'http.server.requests';
export const HTTP_SERVER_ERRORS = 'http.server.errors';
export const HTTP_SERVER_REQUEST_DURATION = 'http.server.request.duration';

const DURATION_BUCKETS = [
    0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
];

type Instruments = {
    requests: Counter;
    errors: Counter;
    duration: Histogram;
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
                description: 'Count of HTTP server requests with status code >= 500',
                unit: '{error}',
            }),
            duration: meter.createHistogram(HTTP_SERVER_REQUEST_DURATION, {
                description: 'Duration of HTTP server requests',
                unit: 's',
                advice: {
                    explicitBucketBoundaries: DURATION_BUCKETS,
                },
            }),
        };
    }

    return instruments;
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
    };
    const current = getInstruments();
    current.requests.add(1, attributes);
    if (input.statusCode >= 500) {
        current.errors.add(1, attributes);
    }
    current.duration.record(input.durationSeconds, attributes);
}
