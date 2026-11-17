# Serie GKE v2 — k6 constant-arrival-rate (post-fix R1)

**Fecha:** 2026-11-16 (UTC-5) / 2026-11-17Z  
**Commit imagen:** `f46e5f4`  
**Imagen:** `us-central1-docker.pkg.dev/cine-devops-canary/cine-canary/cine-api:5.0.1-caos-r1guard-f46e5f4`  
**Digest:** `sha256:8b0172aca858f73c3f3037e95e52418f75fca5b9aae74e1839ec836dd2bfd64b`  
**URL:** `http://35.239.107.54`  
**Réplicas durante medición:** 1 (misma metodología que GKE v1; restauradas a 2 al final)  
**Orden R1:** bulkhead → admission → saturación · `BULKHEAD_ENTER_TIMEOUT_MS=200`

Evidencia GKE v1 (`*-k6-gke.json`) **intacta**. Esta serie usa `*-k6-gke-v2.json`.

## Carga (idéntica a v1)

| Parámetro | Valor |
|-----------|-------|
| Generador | k6 `constant-arrival-rate` |
| Tasa | 80 iter/s |
| Duración | 30s |
| preAllocatedVUs / maxVUs | 40 / 120 |
| Saturación | holdMs=250, maxInflight=8, durationSec=90, maxQueueWaitMs=200 |

## Resultados

| Ronda | Offered HTTP | Success | Failed | 503 | Dropped iters | Success RPS | Success rate | p95 éxito (ms) |
|-------|--------------|---------|--------|-----|----------------|-------------|--------------|----------------|
| Baseline | 2351 | 2350 | 1 | 0 | 50 | **78.33** | 0.9996 | 872 |
| R0 | 2360 | 899 | 1461 | 1460 | 41 | **29.97** | 0.3809 | 861 |
| R1 | 2341 | 836 | 1505 | 1504 | 61 | **27.87** | 0.3571 | 989 |

## Comparación R0 → R1

| Métrica | R0 | R1 | Δ abs | Δ % |
|---------|----|----|-------|-----|
| Throughput exitoso (RPS) | 29.97 | 27.87 | **-2.10** | **-7.0%** |
| Tasa de éxito | 0.3809 | 0.3571 | -0.0238 | — |
| p95 éxito (ms) | 860.65 | 988.8 | +128 | — |
| 503 | 1460 | 1504 | +44 | — |
| Dropped iterations (k6) | 41 | 61 | +20 | — |

`offered_load_comparable`: **true** (oferta ~78 RPS en ambas).

## Hipótesis

Hipótesis original (mejora de throughput exitoso R1 vs R0 bajo el mismo fallo): **NO confirmada** en GKE v2.

- R1 no mejoró RPS ni p95 respecto a R0.
- Sí hubo rechazos controlados 503 con header `x-reject-reason` (ver sonda).
- El techo físico (~8/0.25 ≈ 32 RPS) sigue limitando; admission/bulkhead no aumentan capacidad del recurso saturado.

## Evidencia de patrones

### Bulkhead (producción)

Sonda post-serie (1 réplica, R1 + saturación, 200 requests concurrentes Node):

```json
{ "codes": { "200": 92, "503": 108 }, "reasons": { "bulkhead_timeout": 108 }, "samples": 200 }
```

Archivo: `gke-v2-reject-probe.json`.

### Admission

Activo en R1 (`RESILIENCE_ENABLED=true`) tras obtener cupo de bulkhead (`guard.ts`). Bajo este perfil de saturación, el bulkhead rechaza primero (`bulkhead_timeout`); no se observaron `admission_*` en la sonda de 200 samples. Cobertura unitaria y orden corregido en Continuación #7.

## Restauración

- Saturación detenida.
- `EXPERIMENT_ROUND=baseline`, `RESILIENCE_ENABLED=false`.
- Réplicas **2/2 Ready**.
- `/healthz` 200, `/readyz` 200 (`database=up`), `GET /api/v2/peliculas/1` 200.

## Limitaciones

- Autopilot + LB + proxy Cloud SQL añaden latencia vs local.
- 1 réplica durante medición (justificado: saturación in-process comparable a v1).
- Sonda de headers es ortogonal a k6 (k6 cuenta 503, no desglosa `x-reject-reason`).
