# Contrato Chaos Gate — API Cine (Seguimiento #4)

## Distinción importante

| Concepto | Qué es | Dónde |
|----------|--------|-------|
| **Quality Gate canary** | Errores/p95 y promoción de Cloud Run canary V4 | `.github/workflows/deploy-gcp-canary.yml` + `.github/scripts/quality-gate.py` |
| **Chaos Gate S4** | Evalúa evidencias históricas del experimento de caos (sin caos remoto) | `.github/workflows/cine-s4-chaos-gate.yml` + `scripts/chaos/evaluate-chaos-gate.mjs` |
| **Contrato de ejecución** (abajo) | Cómo *correr* un experimento nuevo (local/lab) | Runner `run-saturation-experiment.mjs` |

El Chaos Gate de GitHub Actions **no** lanza saturación en GKE ni usa secretos GCP.  
Solo lee JSON del repositorio y aplica la política `cine-s4-chaos-gate-policy@1`.

## Chaos Gate propio (GitHub Actions)

Workflow: **Cine S4 - Chaos Gate** (`.github/workflows/cine-s4-chaos-gate.yml`).

Triggers seguros:

- `workflow_dispatch` (manual)
- `pull_request` limitado a rutas de evidencias/evaluador (sin operaciones remotas)

### Cómo ejecutarlo

```bash
npm run chaos:gate
# o
node scripts/chaos/evaluate-chaos-gate.mjs \
  --out-json chaos/gate-out/report.json \
  --summary-md chaos/gate-out/summary.md
```

En GitHub: Actions → **Cine S4 - Chaos Gate** → Run workflow.

### Qué evalúa (bloqueante)

1. JSON de evidencias presentes y parseables.
2. Multicloud 75s: disponibilidad 100 %, completed=expected, p95>0 (`multicloud-75s-series.json`).
3. Bulkhead: ≥1 `bulkhead_timeout` como HTTP 503 (`gke-v2-reject-probe.json`).
4. Admission: ≥1 `inflight_limit` como HTTP 503; `client_error` reportado aparte (`gke-admission-reject-probe.json`).
5. Recuperación: sat off, ≥2 Ready, health 200, round=baseline (`gke-admission-probe-recovery.json`).
6. Serie k6 GKE v2 comparable (`offered_load_comparable=true`).

### Qué reporta sin bloquear

- Hipótesis throughput R1>R0 (`successful_rps`): en GKE v2 queda **NOT_CONFIRMED**.
- Agotamiento de 8 cupos: **NOT_MEASURED**.
- Δ p95 multicloud R1 vs R0: **no atribuido** a patrones.

### Interpretar PASS / FAIL

| Exit | Significado |
|------|-------------|
| 0 | PASS — criterios bloqueantes cumplidos |
| 1 | FAIL — incumplimiento de política/resiliencia |
| 2 | FAIL — evidencia faltante o malformada |

### Evidencias

Índice: `CIERRE_EXPERIMENTO_CAOS.md` · carpeta `evidencias/`.

Limitación multicloud: 0×503; no demuestra bulkhead/admission (sondas ortogonales sí).

---

## Contrato de ejecución de experimento (lab / Jarrison)

Para *correr* saturación (no es el workflow de evaluación histórica):

```bash
export CINE_BASE_URL=http://127.0.0.1:3000
export CHAOS_FAULT_TOKEN='***'
export CINE_PELICULA_ID=1
export EXPERIMENT_ROUND=r0   # o r1 / baseline
export CHAOS_HOLD_MS=200
export CHAOS_MAX_INFLIGHT=4
export CHAOS_DURATION_SEC=30

node scripts/chaos/run-saturation-experiment.mjs > chaos/results/${EXPERIMENT_ROUND}.json
```

Comparación R0 vs R1:

```bash
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json
```

Reversión: `finally` → `POST /api/v3/__test/saturation/stop` + `/healthz`.
