# Serie experimental k6 GKE — Autopilot (cloud real)

**Fecha:** 2026-11-16 / 2026-11-17 UTC  
**URL:** `http://35.239.107.54`  
**Clúster:** `cine-caos-autopilot`  
**Serie:** `gke-k6-constant-arrival-rate`  
**Perfil:** `load/k6/cine-chaos-profile.js` — 80/s × 30s  
**Fallo R0/R1:** holdMs=250, maxInflight=8, maxQueueWaitMs=200, durationSec=90  
**Nota metodológica:** durante las mediciones se usó **1 réplica** para aplicar saturación in-process de forma comparable (el start vía LB solo alcanza un Pod). Tras la serie se restauró **2/2**.

## Baseline (sin fallo)

| Métrica | Valor |
|---------|--------|
| HTTP ofrecidas | 2384 |
| dropped_iterations | 18 |
| RPS exitosas | **79.43** |
| success_rate | 0.9996 |
| 503 | 0 |
| p95 éxitos | 295.39 ms |

## R0

| Métrica | Valor |
|---------|--------|
| HTTP ofrecidas | **2350** |
| dropped | 52 |
| RPS exitosas | **28.60** |
| success_rate | 0.3651 |
| 503 | 1491 |
| p95 éxitos | 1090.56 ms |
| Recuperación | healthz/readyz/peliculas 200 |

## R1 (bulkhead + admission)

| Métrica | Valor |
|---------|--------|
| HTTP ofrecidas | **2324** |
| dropped | 78 |
| RPS exitosas | **21.40** |
| success_rate | 0.2762 |
| 503 | 1681 |
| p95 éxitos | 1578.46 ms |
| Recuperación | healthz/readyz/peliculas 200 |

## Comparación

| Métrica | R0 | R1 | Δ |
|---------|----|----|---|
| Oferta HTTP | 2350 | 2324 | comparable (~1.1 %) |
| RPS exitosas | 28.60 | 21.40 | **−25.2 %** |
| p95 | 1091 | 1578 | peor |
| 503 | 1491 | 1681 | +190 |

**Hipótesis de mejora de throughput: NO confirmada en GKE.**  
Parcial: R1 produjo más 503 controlados (admission/bulkhead). No mejora p95 bajo esta carga.

Archivos: `*-k6-gke.json`, `comparison-k6-gke.json`
