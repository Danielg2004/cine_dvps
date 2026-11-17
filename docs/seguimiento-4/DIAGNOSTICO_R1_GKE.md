# Diagnóstico R1 < R0 en GKE (serie cloud real)

**Evidencia conservada:** `evidencias/*-k6-gke.json` (no se reescribe la conclusión).

| Ronda | successful_rps | success_rate | 503 | p95 | dropped |
|-------|----------------|--------------|-----|-----|---------|
| Baseline | 79.43 | 0.9996 | 0 | 295 | 18 |
| R0 | 28.60 | 0.3651 | 1491 | 1091 | 52 |
| R1 | 21.40 | 0.2762 | 1681 | 1578 | 78 |

## Qué NO es

- No es un fallo de Cloud SQL (readyz `database: up` antes/después).
- No se puede atribuir a “falta de réplicas” como causa única: la serie midió con **1 réplica** a propósito.
- No se puede superar el techo físico ≈ `maxInflight/holdMs` = 8/0.25 ≈ **32 RPS** con admission/bulkhead.

## Causas técnicas (código)

### 1. Fail-fast de admission antes de cualquier cola corta (principal)

Orden R1 original: `admission.tryAdmit()` → `bulkhead.enter()` → saturación.

Con `ADMISSION_MAX_INFLIGHT = BULKHEAD_MAX_CONCURRENT = 8`:

- Los 8 cupos de admission se ocupan durante **todo** el request (incl. `holdMs` de saturación).
- La cola del bulkhead **casi no se usa** (admission ya rechazó).
- R0, en cambio, permite esperar hasta `maxQueueWaitMs` (200 ms) en la cola de saturación **sin** ese rechazo previo → más éxitos oportunistas (~28.6 RPS cerca del techo).

R1 shed más agresivo → más 503 y menos RPS exitoso. Eso es parcialmente **intencional** (protección), pero la cola corta de R0 no tenía equivalente efectivo en R1.

### 2. Timeout de bulkhead desalineado (2000 ms vs 200 ms)

`BULKHEAD_ENTER_TIMEOUT_MS=2000` no aportaba absorción comparable a la cola de saturación (200 ms) porque admission impedía encolar.

### 3. Metodología GKE

- Reinicio de Deployment entre rondas (pods distintos / warm-up).
- R1 con más `dropped_iterations` (78 vs 52) → VUs más ocupados por latencias altas.
- Oferta HTTP aún comparable (2350 vs 2324).

## Beneficios verificables de R1 (sin cambiar la métrica primaria)

| Beneficio | Evidencia |
|-----------|-----------|
| Rechazo controlado 503 | Sí (1681 en R1) |
| Recuperación post-stop | Sí (healthz/readyz/películas 200) |
| Protección fail-fast | Sí (no encola sin límite) |
| Mejora de throughput | **No** |
| Mejora de p95 de éxitos en GKE | **No** en esta serie |

## Hipótesis original

Se mantiene: **NO confirmada** para throughput.  
No se cambia el umbral ni la métrica a posteriori.
