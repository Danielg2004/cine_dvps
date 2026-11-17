# Informe — Experimento de agotamiento (Daniel / Cine)

Documento listo para integrar al informe académico (máx. 6 páginas).

## 1. Objetivo

Evaluar el impacto de una saturación controlada de **concurrencia** sobre el throughput de solicitudes exitosas del endpoint `GET /api/v2/peliculas/:id`, y comparar Ronda 0 (sin protecciones nuevas) frente a Ronda 1 (bulkhead + control de admisión).

## 2. Hipótesis

Si se inyecta saturación de concurrencia sin resiliencia (R0), el throughput exitoso disminuirá respecto al baseline.  
Con bulkhead y admission (R1), bajo el mismo fallo, el throughput exitoso mejorará respecto a R0 y/o se reducirá el impacto de errores no controlados.

## 3. Métrica objetivo

Solicitudes exitosas por segundo (`successful_rps`) en la superficie experimental.

| Indicador | Valor (serie k6 v3, Docker) |
|-----------|------------------------------|
| Baseline RPS | 80.00 (llegada fija 80/s) |
| Umbral degradación R0 | ~32.27 RPS (−60 % vs baseline) |
| Mejora R1 vs R0 | **No**: 30.63 vs 32.27 (−5.1 %) |

## 4. Método de inyección

1. Interruptor: `POST /api/v3/__test/saturation/start`
2. Intensidad lab: holdMs=250, maxInflight=8, maxQueueWaitMs=200, durationSec=90
3. Carga: k6 `constant-arrival-rate` 80/s × 30s (`load/k6/cine-chaos-profile.js`)
4. Rollback: `POST .../stop` + `/healthz`

## 5. Blast radius

Servicio Cine lab Docker / futuro namespace `cine-caos`. Datos sintéticos. No incluye Sports ni Hotel.

## 6. Resultados (serie oficial local comparable)

| Ronda | offered HTTP | successful_rps | success_rate | 503 | p95 éxitos |
|-------|--------------|----------------|--------------|-----|------------|
| Baseline | 2401 | 80.00 | 99.96 % | 0 | 3.24 ms |
| R0 | 2401 | 32.27 | 40.32 % | 1432 | 452 ms |
| R1 | 2402 | 30.63 | 38.26 % | 1482 | 254 ms |

Comparación: `chaos/results/comparison-k6-v3.json`  
Detalle: `docs/seguimiento-4/evidencias/LAB_K6_V3_SUMMARY.md`

Series previas (no oficiales para hipótesis de RPS): v1 in-process, v2 HTTP closed-loop (oferta no comparable).

## 7. Conclusión

- **Hipótesis de mejora de throughput exitoso: NO confirmada** con carga ofrecida comparable.
- R1 **sí** mejora p95 de éxitos (−44 %) y mantiene rechazo controlado 503.
- Límite físico del fallo ≈ `maxInflight / holdMs` ≈ 32 RPS; admission/bulkhead no aumentan ese techo.
- Experimentación **cloud GCP / GKE: no ejecutada** (sin create/apply). Local Docker validado.
