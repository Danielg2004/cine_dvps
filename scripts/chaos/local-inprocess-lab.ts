/**
 * Laboratorio local in-process para baseline / R0 / R1.
 * No requiere Docker ni MySQL: mockea repositorio y DB probe.
 * Genera evidencias reales en chaos/results/*.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from '../../src/app.js';
import { AppDataSourceV2 } from '../../src/config/database-v2.js';
import * as database from '../../src/database.js';
import {
    resetSaturationForTests,
    startSaturation,
    stopSaturation,
} from '../../src/chaos/saturation.js';
import { experimentalAdmission } from '../../src/resilience/admission.js';
import { experimentalBulkhead } from '../../src/resilience/bulkhead.js';

const RESULTS_DIR = join(process.cwd(), 'chaos', 'results');
const TOKEN = 'token-lab-local-seguimiento4';
const PROFILE = {
    concurrency: Number(process.env.LAB_CONCURRENCY || 20),
    totalRequests: Number(process.env.LAB_TOTAL_REQUESTS || 200),
    holdMs: Number(process.env.CHAOS_HOLD_MS || 250),
    maxInflight: Number(process.env.CHAOS_MAX_INFLIGHT || 8),
    durationSec: Number(process.env.CHAOS_DURATION_SEC || 30),
    // Límites bajos para forzar rechazo visible en R1 bajo el mismo perfil de carga
    admissionMax: Number(process.env.ADMISSION_MAX_INFLIGHT || 3),
    bulkheadMax: Number(process.env.BULKHEAD_MAX_CONCURRENT || 2),
};

const pelicula = {
    id: 9001,
    nombre: 'Pelicula Sintetica Chaos',
    duracion: 120,
    genero: 'Drama',
    descripcion: 'Dato sintetico lab local',
};

type Sample = { status: number; latencyMs: number };

function percentile(values: number[], p: number): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)] ?? 0;
}

function summarize(samples: Sample[], round: string) {
    const success = samples.filter((s) => s.status >= 200 && s.status < 400);
    const rejected = samples.filter((s) => s.status === 429 || s.status === 503);
    const failedOther = samples.filter(
        (s) => s.status >= 400 && s.status !== 429 && s.status !== 503
    );
    const latencies = samples.map((s) => s.latencyMs);
    const successRate = samples.length ? success.length / samples.length : 0;

    return {
        experiment_id: 'cine-resource-exhaustion-concurrency-v1',
        round,
        environment: 'local-inprocess',
        with_fault: round !== 'baseline',
        profile: PROFILE,
        samples: samples.length,
        success: success.length,
        failed: samples.length - success.length,
        rejected_429_503: rejected.length,
        failed_other_4xx_5xx: failedOther.length,
        success_rate: Number(successRate.toFixed(4)),
        latencies_ms: {
            avg: Number((latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2)),
            p95: Number(percentile(latencies, 0.95).toFixed(2)),
            p99: Number(percentile(latencies, 0.99).toFixed(2)),
        },
    };
}

async function loadOnce(app: ReturnType<typeof buildApp>, round: string) {
    const samples: Sample[] = [];
    let next = 0;
    const wallStart = performance.now();

    async function worker() {
        while (true) {
            const i = next;
            next += 1;
            if (i >= PROFILE.totalRequests) {
                return;
            }
            const t0 = performance.now();
            const response = await app.inject({
                method: 'GET',
                url: `/api/v2/peliculas/${pelicula.id}`,
                headers: {
                    'x-trace-id': `lab-${round}-${i}`,
                    traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
                },
            });
            samples.push({
                status: response.statusCode,
                latencyMs: performance.now() - t0,
            });
        }
    }

    await Promise.all(Array.from({ length: PROFILE.concurrency }, () => worker()));
    const wallMs = performance.now() - wallStart;
    const summary = summarize(samples, round);
    const successful_rps = summary.success / (wallMs / 1000);
    return {
        summary,
        successful_rps: Number(successful_rps.toFixed(4)),
        wall_ms: Number(wallMs.toFixed(2)),
    };
}

function installMocks() {
    const originalRepo = AppDataSourceV2.getRepository.bind(AppDataSourceV2);
    AppDataSourceV2.getRepository = ((entity: unknown) => {
        void entity;
        return {
            findOneBy: async () => pelicula,
            find: async () => [pelicula],
        };
    }) as typeof AppDataSourceV2.getRepository;

    const originalQuery = database.db.query.bind(database.db);
    (database.db as { query: typeof database.db.query }).query = (async () => [
        [{ ok: 1 }],
    ]) as typeof database.db.query;

    return () => {
        AppDataSourceV2.getRepository = originalRepo;
        database.db.query = originalQuery;
    };
}

function resetRuntime() {
    resetSaturationForTests();
    experimentalAdmission.reset();
    experimentalBulkhead.reset();
}

function writeEvidence(name: string, payload: unknown) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    const path = join(RESULTS_DIR, name);
    writeFileSync(path, JSON.stringify(payload, null, 2));
    return path;
}

async function runRound(round: 'baseline' | 'r0' | 'r1', withFault: boolean) {
    process.env.EXPERIMENT_ROUND = round;
    process.env.CHAOS_FAULT_TOKEN = TOKEN;
    process.env.ADMISSION_MAX_INFLIGHT = String(PROFILE.admissionMax);
    process.env.BULKHEAD_MAX_CONCURRENT = String(PROFILE.bulkheadMax);
    process.env.CACHE_URL = '';

    resetRuntime();
    if (withFault) {
        startSaturation({
            holdMs: PROFILE.holdMs,
            maxInflight: PROFILE.maxInflight,
            durationSec: PROFILE.durationSec,
        });
    }

    const app = buildApp();
    await app.ready();

    try {
        const health = await app.inject({ method: 'GET', url: '/healthz' });
        const contract = await app.inject({
            method: 'GET',
            url: `/api/v2/peliculas/${pelicula.id}`,
            headers: { 'x-trace-id': 'contract-check' },
        });

        const measured = await loadOnce(app, round);

        return {
            ok: true,
            experiment_id: 'cine-resource-exhaustion-concurrency-v1',
            round,
            started_at: new Date().toISOString(),
            steady_state_healthz: health.statusCode,
            contract_status: contract.statusCode,
            contract_trace: contract.headers['x-trace-id'],
            during: {
                successful_rps: measured.successful_rps,
                wall_ms: measured.wall_ms,
                ...measured.summary,
            },
            successful_rps: measured.successful_rps,
            finished_at: new Date().toISOString(),
        };
    } finally {
        stopSaturation('lab_round_end');
        resetRuntime();
        await app.close();
    }
}

async function main() {
    const restore = installMocks();
    try {
        const baseline = await runRound('baseline', false);
        const r0 = await runRound('r0', true);
        const r1 = await runRound('r1', true);

        const baselinePath = writeEvidence('baseline-local.json', baseline);
        const r0Path = writeEvidence('r0.json', r0);
        const r1Path = writeEvidence('r1.json', r1);

        const absolute = r1.successful_rps - r0.successful_rps;
        const pct = r0.successful_rps === 0 ? null : (absolute / r0.successful_rps) * 100;
        const p95Improved = r1.during.latencies_ms.p95 < r0.during.latencies_ms.p95;
        const controlledRejects = r1.during.rejected_429_503 > 0 && r0.during.rejected_429_503 === 0;
        const rpsImproved = pct !== null && pct > 0;

        let hypothesis = 'NO_CONFIRMADA_CON_ESTOS_DATOS';
        if (rpsImproved && controlledRejects) {
            hypothesis = 'SOPORTADA: R1 mejoró RPS exitoso y convirtió sobrecarga en 503';
        } else if (p95Improved && controlledRejects) {
            hypothesis = 'SOPORTADA_PARCIALMENTE: R1 bajó p95 y rechazó sobrecarga con 503 (RPS exitoso del load ofrecido no necesariamente sube)';
        } else if (controlledRejects) {
            hypothesis = 'SOPORTADA_PARCIALMENTE: R1 aplicó admission/bulkhead con 503; revisar RPS/p95';
        }

        const comparison = {
            metric_primary: 'successful_requests_per_second',
            metric_secondary: ['latency_p95_ms', 'rejected_429_503', 'success_rate'],
            baseline: baseline.successful_rps,
            r0: r0.successful_rps,
            r1: r1.successful_rps,
            absolute_diff_r1_minus_r0: absolute,
            percent_change_r1_vs_r0: pct,
            r0_rejected_429_503: r0.during.rejected_429_503,
            r1_rejected_429_503: r1.during.rejected_429_503,
            r0_success_rate: r0.during.success_rate,
            r1_success_rate: r1.during.success_rate,
            r0_p95_ms: r0.during.latencies_ms.p95,
            r1_p95_ms: r1.during.latencies_ms.p95,
            signals: { rpsImproved, p95Improved, controlledRejects },
            hypothesis,
            caution:
                '503/429 no son éxitos. Admission puede bajar RPS del load ofrecido mientras protege el sistema.',
            sources: { baselinePath, r0Path, r1Path },
            generated_at: new Date().toISOString(),
            profile: PROFILE,
        };
        const comparisonPath = writeEvidence('comparison.json', comparison);

        console.log(JSON.stringify({
            ok: true,
            baseline: baseline.successful_rps,
            r0: r0.successful_rps,
            r1: r1.successful_rps,
            comparisonPath,
            hypothesis: comparison.hypothesis,
            r0_rejected: comparison.r0_rejected_429_503,
            r1_rejected: comparison.r1_rejected_429_503,
        }, null, 2));
    } finally {
        restore();
        resetRuntime();
    }
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
    }));
    process.exit(1);
});
