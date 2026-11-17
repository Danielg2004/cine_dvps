/**
 * Laboratorio local in-process — serie v2 (ventana fija).
 * Conserva resultados previos en docs; escribe chaos/results/*-v2.json
 *
 * Throughput = exitosos / windowSec (misma ventana para baseline/R0/R1).
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

/**
 * Capacidad alineada: admission == bulkhead == saturación maxInflight.
 * Concurrencia ofrecida > capacidad → hay sobrecarga real, sin matar admitidos.
 */
const PROFILE = {
    series: 'v2-fixed-window',
    concurrency: Number(process.env.LAB_CONCURRENCY || 20),
    windowSec: Number(process.env.LAB_WINDOW_SEC || 6),
    holdMs: Number(process.env.CHAOS_HOLD_MS || 250),
    maxInflight: Number(process.env.CHAOS_MAX_INFLIGHT || 8),
    durationSec: Number(process.env.CHAOS_DURATION_SEC || 30),
    maxQueueWaitMs: Number(process.env.CHAOS_MAX_QUEUE_WAIT_MS || 200),
    admissionMax: Number(process.env.ADMISSION_MAX_INFLIGHT || 8),
    bulkheadMax: Number(process.env.BULKHEAD_MAX_CONCURRENT || 8),
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

function summarize(samples: Sample[], round: string, windowSec: number) {
    const success = samples.filter((s) => s.status >= 200 && s.status < 400);
    const rejected503 = samples.filter((s) => s.status === 503);
    const rejected429 = samples.filter((s) => s.status === 429);
    const failedOther = samples.filter(
        (s) => s.status >= 400 && s.status !== 429 && s.status !== 503
    );
    const successLatencies = success.map((s) => s.latencyMs);
    const allLatencies = samples.map((s) => s.latencyMs);
    const successRate = samples.length ? success.length / samples.length : 0;
    const successful_rps = success.length / windowSec;

    return {
        experiment_id: 'cine-resource-exhaustion-concurrency-v1',
        series: PROFILE.series,
        round,
        environment: 'local-inprocess',
        with_fault: round !== 'baseline',
        measurement: 'fixed_window_sustained_load',
        profile: PROFILE,
        window_sec: windowSec,
        samples: samples.length,
        success: success.length,
        failed: samples.length - success.length,
        rejected_503: rejected503.length,
        rejected_429: rejected429.length,
        rejected_429_503: rejected503.length + rejected429.length,
        failed_other_4xx_5xx: failedOther.length,
        success_rate: Number(successRate.toFixed(4)),
        successful_rps: Number(successful_rps.toFixed(4)),
        latencies_ms: {
            all_p95: Number(percentile(allLatencies, 0.95).toFixed(2)),
            success_p95: Number(percentile(successLatencies, 0.95).toFixed(2)),
            avg_all: Number((allLatencies.reduce((a, b) => a + b, 0) / (allLatencies.length || 1)).toFixed(2)),
        },
    };
}

async function loadWindow(app: ReturnType<typeof buildApp>, round: string) {
    const samples: Sample[] = [];
    const windowMs = PROFILE.windowSec * 1000;
    const deadline = performance.now() + windowMs;
    let seq = 0;

    async function worker() {
        while (performance.now() < deadline) {
            const i = seq;
            seq += 1;
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

    const wallStart = performance.now();
    await Promise.all(Array.from({ length: PROFILE.concurrency }, () => worker()));
    const wallMs = performance.now() - wallStart;
    const summary = summarize(samples, round, PROFILE.windowSec);
    return {
        summary,
        successful_rps: summary.successful_rps,
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
            maxQueueWaitMs: PROFILE.maxQueueWaitMs,
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

        const measured = await loadWindow(app, round);

        return {
            ok: true,
            experiment_id: 'cine-resource-exhaustion-concurrency-v1',
            series: PROFILE.series,
            round,
            started_at: new Date().toISOString(),
            steady_state_healthz: health.statusCode,
            contract_status: contract.statusCode,
            contract_trace: contract.headers['x-trace-id'],
            during: {
                ...measured.summary,
                wall_ms: measured.wall_ms,
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

        const baselinePath = writeEvidence('baseline-local-v2.json', baseline);
        const r0Path = writeEvidence('r0-v2.json', r0);
        const r1Path = writeEvidence('r1-v2.json', r1);

        // Compatibilidad con compare-rounds.mjs (lee r0.json / r1.json)
        writeEvidence('r0.json', r0);
        writeEvidence('r1.json', r1);
        writeEvidence('baseline-local.json', baseline);

        const absolute = r1.successful_rps - r0.successful_rps;
        const pct = r0.successful_rps === 0 ? null : (absolute / r0.successful_rps) * 100;
        const p95SuccessImproved =
            r1.during.latencies_ms.success_p95 > 0 &&
            r0.during.latencies_ms.success_p95 > 0 &&
            r1.during.latencies_ms.success_p95 <= r0.during.latencies_ms.success_p95 * 1.05;
        const controlledRejects = r1.during.rejected_429_503 > 0;
        const r0AlsoDegraded = r0.during.success_rate < 0.999 || r0.during.rejected_429_503 > 0;
        const rpsImproved = pct !== null && pct > 0;
        const rpsSimilar = pct !== null && Math.abs(pct) <= 15;

        let hypothesis = 'NO_CONFIRMADA_CON_ESTOS_DATOS';
        if (rpsImproved && (controlledRejects || r0AlsoDegraded)) {
            hypothesis = 'SOPORTADA: R1 mejoró throughput exitoso bajo el mismo fallo';
        } else if (rpsSimilar && controlledRejects && p95SuccessImproved) {
            hypothesis = 'SOPORTADA_PARCIALMENTE: R1 sostiene RPS similar con rechazos controlados y p95 de éxitos acotado';
        } else if (controlledRejects && r0AlsoDegraded) {
            hypothesis = 'SOPORTADA_PARCIALMENTE: ambos muestran sobrecarga; R1 convierte exceso en 503 controlados';
        }

        const comparison = {
            series: PROFILE.series,
            metric_primary: 'successful_requests_per_second',
            metric_secondary: ['success_rate', 'rejected_429_503', 'success_p95_ms'],
            measurement: 'fixed_window_sustained_load',
            window_sec: PROFILE.windowSec,
            baseline: baseline.successful_rps,
            r0: r0.successful_rps,
            r1: r1.successful_rps,
            absolute_diff_r1_minus_r0: absolute,
            percent_change_r1_vs_r0: pct,
            r0_success_rate: r0.during.success_rate,
            r1_success_rate: r1.during.success_rate,
            r0_rejected_429_503: r0.during.rejected_429_503,
            r1_rejected_429_503: r1.during.rejected_429_503,
            r0_success_p95_ms: r0.during.latencies_ms.success_p95,
            r1_success_p95_ms: r1.during.latencies_ms.success_p95,
            signals: { rpsImproved, rpsSimilar, p95SuccessImproved, controlledRejects, r0AlsoDegraded },
            hypothesis,
            caution: 'Serie v1 (lote cerrado) conservada en LAB_LOCAL_SUMMARY.md; no mezclar series.',
            sources: { baselinePath, r0Path, r1Path },
            generated_at: new Date().toISOString(),
            profile: PROFILE,
        };
        const comparisonPath = writeEvidence('comparison-v2.json', comparison);
        writeEvidence('comparison.json', comparison);

        console.log(JSON.stringify({
            ok: true,
            series: PROFILE.series,
            baseline: baseline.successful_rps,
            r0: r0.successful_rps,
            r1: r1.successful_rps,
            r0_success_rate: r0.during.success_rate,
            r1_success_rate: r1.during.success_rate,
            r0_rejected: r0.during.rejected_429_503,
            r1_rejected: r1.during.rejected_429_503,
            comparisonPath,
            hypothesis: comparison.hypothesis,
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
