# Runbook R0 / R1 — telemetría en `cine-seguridad-exp3`

## Hipótesis de control (definitiva)

**Inyección idéntica en R0 y R1:** `emitter-b` silencioso, `emitter-a` continúa.

**Mecanismo (obligatorio):** patch de `cine-exp3-emitter-b-flags` montado en `/emit-flags` — el proceso relee en cada tick.  
**Prohibido:** `kubectl rollout restart` en inject/restore (cambia `instanceId` y anula R1; ver `METODOLOGIA-R1-RESTART-ERROR.md`).

| Ronda | Única variable | Resultado esperado |
|-------|----------------|--------------------|
| **R0** | Detector **agregado** | **Sin ALERT** (A mantiene `lastOk`) |
| **R1** | Detector **por instancia** | **ALERT** + `lossKind=partial` (mismo `instanceId` B armado) |

**Prueba complementaria (no compara R0/R1):** `overlays/inject-total` (A+B silent) → ambos modos alertan; R1 `lossKind=total`.

**No declarar mejora R1** hasta ALERT GKE verificable tras redeploy con flags por volumen.

## Estado estable

- A/B emitiendo; `/detector-samples` con ambas `instanceId`.
- Detector armado; FP pre-inyección = 0.
- DevOps `cine-caos/cine-api` **2/2** (solo lectura).
- Duración máx. 45 min.

## Contención (ABORT)

1. Crear `controls/ABORT` o `CINE_TELEMETRY_CHAOS_ABORT=1` → `abortRequestedAtUtc`.
2. Aplicar `overlays/contain` (CONTAINMENT_ACTIVE=true) **solo** en `cine-seguridad-exp3` → `containedAtUtc`.
3. Emisores fuerzan emisión → cesa la condición adversa.
4. `overlays/restore` + CONTAINMENT_ACTIVE=false → baseline.
5. `telemetryRestoredAtUtc` cuando detector vuelve OK (**≠ MTTC**).

## Métricas

MTTD / MTTC / restore_sec / cobertura / FP — ver `experiments/cine-telemetry-loss.design.json`.

## Runner local (sin GKE)

```bash
node seguridad-caos-exp3/scripts/exp3-lab-runner.mjs
```
