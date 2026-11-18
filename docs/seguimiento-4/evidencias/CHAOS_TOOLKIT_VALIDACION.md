# Chaos Toolkit — validación (Sin ejecución remota GKE)

**Fecha UTC validación:** 2026-11-18  
**Herramienta:** Chaos Toolkit `1.21.4` + `chaostoolkit-lib 1.45.1`  
**Experimento:** `chaos/experiments/cine-resource-exhaustion.json`

## Intensidad alineada a R0/R1 (manifiesto)

Defaults del JSON / `experiment.yaml` (serie GKE v2 y multicloud 75s):

| Parámetro | Valor |
|-----------|-------|
| holdMs | 250 |
| maxInflight | 8 |
| maxQueueWaitMs | 200 |
| durationSec | 90 |

`experiment.yaml` distingue **métricas observadas** (`observed_gke_v2`) de **umbrales de aceptación** (`acceptance_thresholds`). No se reescribieron JSON históricos k6/sondas.

## Resultado

| Paso | Estado |
|------|--------|
| `chaos validate` | OK (tras corrección de probe inválida + alineación R0/R1) |
| `chaos run --dry activities` | OK — journal: `chaos-toolkit-dry-run-journal.json` |
| `chaos run` real contra GKE | **NO ejecutado** — falta ventana coordinada Sports/Hotel |

## Defecto corregido antes de dry-run

La probe `saturation-is-active` usaba `provider.type=python` + módulo `chaoslib.http` (inexistente como módulo Python).  
Se reemplazó por `provider.type=http` + tolerancia `jsonpath` sobre `$.active`.

También:

- Body JSON correcto en start/stop.
- Rollback con verificación `active=false` + healthz.
- Duración por defecto 20 s (acotada; API ≤120).
- Wrapper `scripts/chaos/run-chaos-toolkit.ps1` con `--rollback-strategy always` + stop manual en `finally`.

## Fallo que inyectaría (cuando se autorice)

`POST /api/v3/__test/saturation/start` — hold de concurrencia in-process (no Chaos Mesh/Litmus).

## Probes declaradas

Steady-state: healthz, readyz, GET películas → HTTP 200.  
Durante método: saturación `active=true`.  
Rollback: stop + `active=false` + healthz 200.

## Reversibilidad

1. Rollbacks CTK con `--rollback-strategy always`.
2. Auto-stop API por `durationSec`.
3. Stop manual independiente: `POST .../saturation/stop`.

**Nota 2 réplicas:** el start vía LB satura **un** pod. Cobertura completa requiere 1 réplica solo en ventana autorizada + restore a 2.

## Comando preparado (NO ejecutar sin coordinación)

```powershell
# Tras confirmar que Sports/Hotel no usan Cine:
$env:CINE_BASE_URL = 'http://35.239.107.54'
$env:CHAOS_FAULT_TOKEN = '***'   # no commitear
$env:CHAOS_HOLD_MS = '250'
$env:CHAOS_MAX_INFLIGHT = '8'
$env:CHAOS_MAX_QUEUE_WAIT_MS = '200'
$env:CHAOS_DURATION_SEC = '90'
.\scripts\chaos\run-chaos-toolkit.ps1 -RealRun -ConfirmSharedWindow
```

## Estado operativo observado al validar (HTTP, sin caos)

- healthz 200, readyz ready, db up, películas 200.
- kubectl/cluster describe temporalmente 503 (GCP API) — no bloqueó la validación local del experimento.
