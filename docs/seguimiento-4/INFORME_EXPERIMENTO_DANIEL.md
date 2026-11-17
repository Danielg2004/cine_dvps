# Informe — Experimento de agotamiento (Daniel / Cine)

Documento listo para integrar al informe académico (máx. 6 páginas).

## 1. Objetivo

Evaluar el impacto de una saturación controlada de **concurrencia** sobre el throughput de solicitudes exitosas del endpoint `GET /api/v2/peliculas/:id`, y comparar Ronda 0 (sin protecciones nuevas) frente a Ronda 1 (bulkhead + control de admisión).

## 2. Hipótesis

Si se inyecta saturación de concurrencia sin resiliencia (R0), el throughput exitoso disminuirá respecto al baseline.  
Con bulkhead y admission (R1), bajo el mismo fallo, el throughput exitoso mejorará respecto a R0 y/o se reducirá el impacto de errores no controlados.

## 3. Métrica objetivo

Solicitudes exitosas por segundo (`successful_rps`) en la superficie experimental.

| Indicador | Local k6 v3 | GKE v2 (oficial cloud) |
|-----------|-------------|-------------------------|
| Baseline RPS | 80.00 | 78.33 |
| R0 RPS | 32.27 | 29.97 |
| R1 RPS | 30.63 (−5.1 % vs R0) | 27.87 (−7.0 % vs R0) |
| Mejora throughput R1 | **No** | **No** |

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

## 7. Resultados cloud (GKE Autopilot)

Misma carga k6 80/s × 30s; 1 réplica durante medición; LB `http://35.239.107.54`.

| Serie | Baseline RPS | R0 RPS | R1 RPS | Δ R1−R0 | Conclusión throughput |
|-------|--------------|--------|--------|---------|------------------------|
| GKE v1 (imagen pre-fix) | 79.43 | 28.6 | 21.4 | −25 % | NO confirmada |
| GKE v2 (bulkhead→admission, timeout 200 ms) | 78.33 | 29.97 | 27.87 | −7 % | NO confirmada |

Evidencias k6: `*-k6-gke.json` (v1 intacta), `*-k6-gke-v2.json`, `LAB_K6_GKE_V2_SUMMARY.md`.  
Bulkhead GKE: `x-reject-reason: bulkhead_timeout` (`gke-v2-reject-probe.json`, 108/200).  
Admission GKE: `x-reject-reason: inflight_limit` (`gke-admission-reject-probe.json`, 9/80; AD=2, BH=8).  
Multicloud 75 s: `MULTICLOUD_75S_SERIES.md` (264/264, 186/186, 186/186) — mide flujo Sports→Cine; **no** demuestra patrones.

## 8. Conclusión

- **Hipótesis de mejora de throughput exitoso: NO confirmada** (local k6 v3, GKE v1 y GKE v2).
- Localmente R1 mejoró p95 de éxitos (−44 %); en GKE v2 p95 no mejoró.
- Rechazo controlado 503 con `x-reject-reason` verificado en GKE (bulkhead + admission, sondas).
- Límite físico del fallo ≈ `maxInflight / holdMs` ≈ 32 RPS; admission/bulkhead no aumentan ese techo.
- Clúster vivo: `cine-caos-autopilot`, imagen `5.0.1-caos-w3c-83efd43`, 2 réplicas restauradas.
