# Chaos Toolkit — validación y corrida real GKE

**Herramienta:** Chaos Toolkit `1.21.4` + `chaostoolkit-lib 1.45.x`  
**Experimento:** `chaos/experiments/cine-resource-exhaustion.json`

## Intensidad alineada a R0/R1 (manifiesto)

| Parámetro | Valor |
|-----------|-------|
| holdMs | 250 |
| maxInflight | 8 |
| maxQueueWaitMs | 200 |
| durationSec | 90 |

## Resultado

| Paso | Estado |
|------|--------|
| `chaos validate` | OK |
| `chaos run --dry activities` | OK — `chaos-toolkit-dry-run-journal.json` |
| `chaos run` real GKE | **OK** — `chaos-toolkit-journal.json` (ver `CHAOS_TOOLKIT_REAL_RUN.md`) |

## Defectos corregidos antes / durante la ventana

1. Probe inválida `python`/`chaoslib.http` → HTTP (dry-run previo).
2. Secrets planos → anidados `secrets.cine.cine_chaos_token` (CTK `ChainMap` exige mapa de mapas).
3. `provider.body` ignorado por CTK → `provider.arguments` (JSON real en POST).

## Fallo inyectado

`POST /api/v3/__test/saturation/start` — hold de concurrencia in-process (no Chaos Mesh/Litmus).  
Confirmado en journal: HTTP 202, `active=true`, config 250/8/90/200.

## Reversibilidad verificada

1. Rollbacks CTK con `--rollback-strategy always` → stop HTTP 200, `active=false`.
2. Stop manual del wrapper en `finally`.
3. Restore a **2/2 Ready**.

## Comando (ventana coordinada)

```powershell
$env:CINE_BASE_URL = 'http://35.239.107.54'
$env:CHAOS_FAULT_TOKEN = '***'   # no commitear
$env:CHAOS_HOLD_MS = '250'
$env:CHAOS_MAX_INFLIGHT = '8'
$env:CHAOS_MAX_QUEUE_WAIT_MS = '200'
$env:CHAOS_DURATION_SEC = '90'
.\scripts\chaos\run-chaos-toolkit.ps1 -RealRun -ConfirmSharedWindow
```
