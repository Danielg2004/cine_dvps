# Serie multicloud 75 s — Sports k6 → Cine GKE (2026-11-17)

Evidencia operativa. **No** sobrescribe `*-k6-gke*.json` históricos.

## Resultados Sports (Jarrison)

| Ronda | RUN_ID | Completas | Disp. | p95 (ms) | Tasa obs. |
|-------|--------|-----------|-------|----------|-----------|
| Baseline | cine-baseline-20261117-164725 | 264/264 | 100 % | 481.74 | 3.50/s |
| R0 | cine-r0-20261117-170417 | 186/186 | 100 % | 715.09 | 2.46/s |
| R1 | cine-r1-20261117-171742 | 186/186 | 100 % | 696.51 | 2.47/s |

Δ p95 R1−R0 ≈ **−2.6 %** (−18.58 ms). Disponibilidad sin cambio.

## Saturación Cine (Cloud Logging)

| | R0 | R1 |
|--|----|----|
| Start UTC | 22:05:49.671Z | 22:17:46.975Z |
| Stop UTC | 22:07:19.673Z | 22:19:16.977Z |
| Motivo stop | `timeout` (90 s) | `timeout` (90 s) |
| Config | holdMs=250, maxInflight=8, maxQueueWaitMs=200, durationSec=90 | igual |
| appliedCount | 186 | 186 |
| Cobertura k6 | sí | sí |
| Películas en ventana | 186×200 | 186×200 |
| 429/503 | 0 | 0 |

## Patrones R1

- Habilitados: `EXPERIMENT_ROUND=r1`, `RESILIENCE_ENABLED=true` (pre-ronda).
- Intervención bulkhead/admission: **no demostrada en esta serie** (0 rechazos, sin métrica de peak in-flight).
- Concurrencia máxima real: **no medida**; perfil Sports ≤4 VUs + Hotel→Cine secuencial ⇒ techo plausible ≤4 ≪ 8.
- Evidencia de patrones (sondas ortogonales, no esta serie): `gke-v2-reject-probe.json` (bulkhead), `gke-admission-reject-probe.json` (admission).

## Interpretación

R0/R1 muestran **retardo por holdMs** bajo saturación configurada, no agotamiento demostrado de 8 cupos. La ligera mejora p95 R1 vs R0 **no** prueba eficacia de bulkhead/admission.

## Restauración

- Saturación `active=false`
- `EXPERIMENT_ROUND=baseline`, `RESILIENCE_ENABLED=false` (estado pre-experimento)
- **2/2 Ready**, healthz/readyz/películas 200, SQL `up`, OTLP configured
- Smoke flujo: HTTP 200, `success`, `degraded=false`, Hotel upstream, Cine database
