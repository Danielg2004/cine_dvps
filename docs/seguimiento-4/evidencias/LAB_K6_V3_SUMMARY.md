# Serie experimental k6 v3 — constant-arrival-rate (Docker local)

**Fecha:** 2026-11-16 / 2026-11-17 UTC  
**Proyecto Compose:** `cine-lab-s4`  
**Serie:** `v3-k6-constant-arrival-rate`  
**Hipótesis original (sin cambiar):** R1 (bulkhead + admission) mejora el **throughput exitoso** bajo agotamiento de concurrencia frente a R0.

## Perfil fijo (idéntico en baseline / R0 / R1)

| Parámetro | Valor |
|-----------|--------|
| Executor | `constant-arrival-rate` |
| Tasa | 80 iter/s |
| Duración | 30 s |
| Objetivo ofrecido | 2400 iteraciones |
| preAllocatedVUs | 40 |
| maxVUs | 120 |
| Endpoint | `GET /api/v2/peliculas/1` |
| Fallo (R0/R1) | holdMs=250, maxInflight=8, maxQueueWaitMs=200, durationSec=90 |
| Límites R1 | ADMISSION_MAX_INFLIGHT=8, BULKHEAD_MAX_CONCURRENT=8 |

Script: `load/k6/cine-chaos-profile.js`  
Orquestación: `npm run chaos:lab:k6`

**Nota:** no usar `K6_DURATION`/`K6_VUS` en el entorno del proceso; anulan el scenario.

## Resultados

### Baseline (sin fallo)

| Métrica | Valor |
|---------|--------|
| HTTP ofrecidas | 2401 |
| dropped_iterations | 0 |
| RPS exitosas | **80.00** |
| Tasa de éxito | 99.96 % |
| 503 / 429 | 0 / 0 |
| p95 éxitos | 3.24 ms |

### R0 (sin patrones nuevos)

| Métrica | Valor |
|---------|--------|
| HTTP ofrecidas | **2401** |
| offered RPS | 80.03 |
| dropped_iterations | 0 |
| RPS exitosas | **32.27** |
| Tasa de éxito | 40.32 % |
| 503 | 1432 |
| 429 | 0 |
| p95 éxitos | 452.23 ms |

### R1 (bulkhead + admission)

| Métrica | Valor |
|---------|--------|
| HTTP ofrecidas | **2402** |
| offered RPS | 80.07 |
| dropped_iterations | 0 |
| RPS exitosas | **30.63** |
| Tasa de éxito | 38.26 % |
| 503 | 1482 |
| 429 | 0 |
| p95 éxitos | 254.07 ms |

## Comparación (carga ofrecida comparable)

| Métrica | R0 | R1 | Δ |
|---------|----|----|---|
| HTTP ofrecidas | 2401 | 2402 | +0.04 % (comparable) |
| RPS exitosas | 32.27 | 30.63 | **−5.1 %** |
| success_rate | 0.403 | 0.383 | peor |
| 503 | 1432 | 1482 | +50 |
| p95 éxitos | 452 ms | 254 ms | mejor (−44 %) |

Archivos: `chaos/results/*-k6-v3.json`, `chaos/results/comparison-k6-v3.json`

## Conclusión honesta

1. **Throughput exitoso:** la hipótesis **NO se confirma**. R1 no mejora RPS exitoso respecto a R0 bajo la misma llegada abierta.
2. **Resiliencia parcial:** R1 reduce p95 de éxitos y mantiene rechazos 503 controlados.
3. **Límite físico:** con `maxInflight=8` y `holdMs=250`, la capacidad teórica ≈ `8 / 0.25 = 32` RPS. Bulkhead/admission **no pueden** superar ese techo del recurso saturado; solo protegen el resto del sistema rechazando antes.
4. Series anteriores (v1 in-process, v2 HTTP closed-loop) se conservan en `chaos/results/` y archivos `*-http-v2*`; no se reinterpretan.

## Defecto corregido durante Continuación #4

La primera ejecución k6 usó por error el executor default (1 VU) porque `K6_DURATION` anuló `scenarios`. Se archivó en `chaos/results/archive-k6-v3-invalid-closed-loop/` y se repitió con variables `CINE_*`.
