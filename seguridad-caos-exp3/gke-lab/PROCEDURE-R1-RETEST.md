# Procedimiento — nueva ejecución R1 (y opcional R0) en GKE

**Estado:** preparado localmente. **NO desplegar sin autorización explícita.**

## Prerrequisitos

1. Manifiestos con `/emit-flags` + `EMIT_FLAGS_DIR` validados (`validate-local.mjs`).
2. Tests verdes: `seguridad-caos-exp3-emit-gate-stable-id` + partial R0/R1.
3. DevOps `cine-caos/cine-api` 2/2 · LB `35.239.107.54` (solo lectura).
4. Evidencias previas en `evidencias-locales/gke-r0-r1/` **sin sobrescribir** JSON históricos; usar subcarpeta nueva p.ej. `gke-r0-r1-retest/`.

## Pasos (cuando se autorice)

### A. Desplegar lab (base corregida)

```bash
kubectl apply -k seguridad-caos-exp3/gke-lab/base
# Esperar 3/3 Ready; DNS OK; /detector-samples con A y B
# Verificar: kubectl -n cine-seguridad-exp3 exec deploy/cine-exp3-emitter-b -- ls /emit-flags
# Verificar healthz: emitFlagsDir=/emit-flags, instanceId estable
```

### B. Inyección parcial (R0 y R1 — idéntica, SIN restart)

```bash
# Solo ConfigMap (el proceso relee el volumen)
kubectl -n cine-seguridad-exp3 patch cm cine-exp3-emitter-b-flags --type merge \
  -p '{"data":{"TELEMETRY_EMIT_ENABLED":"false","OTEL_METRICS_EXPORTER":"none"}}'
# PROHIBIDO: kubectl rollout restart …
# Confirmar: healthz emitEnabled=false y MISMO instanceId que pre-inyección
# Observar > silenceThresholdSec (60s) con A aún emitiendo
```

### C. Detección

- **R0:** `evaluateTelemetrySilence` → esperado **sin ALERT**
- **R1:** `evaluateTelemetrySilenceByInstance` → esperado **ALERT** + `lossKind=partial` + id de B armado

### D. ABORT / contención / restore

```bash
# ABORT local + containment volume
kubectl -n cine-seguridad-exp3 patch cm cine-exp3-containment --type merge \
  -p '{"data":{"CONTAINMENT_ACTIVE":"true"}}'
# Verificar emisión forzada (mismo instanceId)
# Restore:
kubectl -n cine-seguridad-exp3 patch cm cine-exp3-containment --type merge \
  -p '{"data":{"CONTAINMENT_ACTIVE":"false"}}'
kubectl -n cine-seguridad-exp3 patch cm cine-exp3-emitter-b-flags --type merge \
  -p '{"data":{"TELEMETRY_EMIT_ENABLED":"true","OTEL_METRICS_EXPORTER":"otlp"}}'
# SIN rollout restart
```

### E. Runner

```bash
# Preferir salida en carpeta nueva para no pisar evidencias 2026-11-18
node seguridad-caos-exp3/scripts/exp3-gke-r0-r1-runner.mjs
# o la copia actualizada en evidencias-locales/gke-r0-r1/run-gke-r0-r1.mjs
# con EV_DIR apuntando a gke-r0-r1-retest (ajustar si se parametriza)
```

### F. Criterio de éxito R1

Solo si existen en GKE:

- `alert: true`
- `lossKind: partial`
- `alertingInstanceIds` incluye el **mismo** `instanceId` de B pre-inyección
- `MTTD_sec` numérico (no null, no inventado)

### G. Teardown

```bash
kubectl delete namespace cine-seguridad-exp3 --wait=true
kubectl -n cine-caos get deploy cine-api   # 2/2
```
