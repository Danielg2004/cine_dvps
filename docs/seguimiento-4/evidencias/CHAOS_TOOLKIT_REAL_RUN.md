# Chaos Toolkit — corrida real GKE (Seguimiento #4)

**Fecha UTC:** 2026-11-18  
**Herramienta:** Chaos Toolkit `1.21.4` + `chaostoolkit-lib`  
**Experimento:** `chaos/experiments/cine-resource-exhaustion.json`  
**Wrapper:** `scripts/chaos/run-chaos-toolkit.ps1 -RealRun -ConfirmSharedWindow`  
**Ventana:** autorizada por Samuel (Hotel) y Jarrison (Sports)

## Intensidad (sin cambio)

| Parámetro | Valor |
|-----------|-------|
| holdMs | 250 |
| maxInflight | 8 |
| maxQueueWaitMs | 200 |
| durationSec | 90 |

## Preparación

- Escala temporal a **1 réplica** (saturación in-process por pod).
- Saturación `active=false` antes del run.
- healthz / readyz / películas HTTP 200.

## Corrida válida (inyección auténtica)

| Evento | UTC |
|--------|-----|
| Inicio experimento | `2026-11-18T01:33:50.314811+00:00` |
| Activación (start 202) | ~`2026-11-18T01:33:51Z` |
| Probe `active=true` | ~`2026-11-18T01:33:53Z` |
| Desactivación (stop 200) | ~`2026-11-18T01:33:55Z` |
| Fin experimento | `2026-11-18T01:33:55.919467+00:00` |

| Resultado | Valor |
|-----------|-------|
| Journal CTK `status` | `completed` |
| `deviated` | `false` |
| Start HTTP | **202** — `saturacion activada`, config 250/8/90/200 |
| Probe método | `active=true` |
| Stop HTTP | **200** — `saturacion desactivada` |
| Probe rollback | `active=false` |
| healthz post-rollback | 200 |
| Stop manual wrapper (`finally`) | `active=false` |

**Journal:** `chaos-toolkit-journal.json`

## Intento previo (no válido como inyección)

Antes de la corrida válida, un intento con `provider.body` (ignorado por CTK; usa `arguments`) devolvió HTTP 400 *empty JSON body* y **no** activó saturación. Journal conservado como evidencia del defecto:

`chaos-toolkit-journal-run1-empty-body.json`

Corrección aplicada: `body` → `arguments` + secrets anidados (`secrets.cine.*`) exigidos por `chaostoolkit-lib` 1.45.

## Recuperación

| Control | Resultado |
|---------|-----------|
| Saturación | `active=false` |
| Réplicas | **2/2 Ready** |
| healthz | 200 |
| readyz | ready, `database=up` |
| películas/1 | 200 |
| OpenTelemetry | `otelTraceId` / `otelSpanId` en logs |
| Flujo Sports→Hotel→Cine | HTTP 200, `status=success`, `degraded=false` |

## Secretos

Journals sanitizados: cabeceras `x-chaos-token` → `***REDACTED***`. Token solo vía Secret Manager / env en runtime.
