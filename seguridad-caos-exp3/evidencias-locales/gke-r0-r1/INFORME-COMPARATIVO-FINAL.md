# Informe comparativo R0/R1 — Experimento 3 (GKE real)

**Completado UTC:** 2026-11-18T17:29:24.809Z  
**Namespace lab:** `cine-seguridad-exp3` (eliminado)  
**Evidencias:** `seguridad-caos-exp3/evidencias-locales/gke-r0-r1/`

## 1. Resultados R0 (detector agregado)

| Campo | Valor observado |
|-------|-----------------|
| Inyección | partial B silent / A OK |
| `faultInjectedAtUtc` | 2026-11-18T17:18:12.293Z |
| ALERT | **false** (esperado) |
| MTTD | **null** (no detectado; no se reporta 0) |
| Cobertura detección | 0 |
| FP pre-inyección | 0 |
| `abortRequestedAtUtc` | 2026-11-18T17:19:47.306Z |
| `containAppliedAtUtc` | 2026-11-18T17:19:47.306Z |
| `containedAtUtc` (verificado) | 2026-11-18T17:21:06.669Z |
| MTTC | **174.376 s** |
| `telemetryRestoredAtUtc` | 2026-11-18T17:21:40.965Z |
| restore_sec | **34.296 s** |

Hipótesis R0 (ceguera a pérdida parcial): **confirmada**.

## 2. Resultados R1 (detector por instancia)

| Campo | Valor observado |
|-------|-----------------|
| Inyección | misma partial B silent / A OK |
| `faultInjectedAtUtc` | 2026-11-18T17:24:42.098Z |
| ALERT | **false** |
| lossKind | none |
| MTTD | **null** |
| Cobertura | 0 |
| FP pre-inyección | 0 |
| MTTC (contain verificado) | **159.519 s** |
| restore_sec | **63.996 s** |

Hipótesis R1 (ALERT + `lossKind=partial`): **no confirmada en esta corrida**.  
Ver `ADDENDUM-R1-METODOLOGIA.json`: el restart de B impidió armar la instancia B antes del silencio.

## 3. Comparación de métricas

| Métrica | R0 | R1 |
|---------|----|----|
| ALERT | no | no (inválido p/ hipótesis) |
| MTTD_sec | null | null |
| MTTC_sec | 174.376 | 159.519 |
| restore_sec | 34.296 | 63.996 |
| FP pre-inject | 0 | 0 |
| Cobertura | 0 | 0 |

## 4. Contención / recuperación

- ABORT local + patch `CONTAINMENT_ACTIVE=true` → archivo montado `true` en A/B + reaparición de muestras B.
- Restore: flags B=`true`, containment=`false`, rollout B, ambas instancias sanas antes de teardown.

## 5. Teardown / DevOps

- Namespace `cine-seguridad-exp3`: **eliminado** (`NotFound`).
- `cine-caos/cine-api`: **2/2 Ready**
- LoadBalancer: **35.239.107.54** intacto

## 6. Pendientes para declarar Exp. 3 individual terminado

1. Redeploy lab con inyección **sin cambio de instanceId** (flag de emit por volumen, como containment).
2. Re-ejecutar **solo R1** (o R0+R1) y obtener ALERT + `lossKind=partial` + MTTD medible.
3. Actualizar diseño/runbook con el método de inyección sin restart.
4. Commit/push solo cuando se autorice.
