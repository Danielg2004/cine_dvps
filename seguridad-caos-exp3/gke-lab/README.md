# Manifiesto de laboratorio GKE — Exp. 3 (NO APLICAR aún)

**Estado:** preparado para revisión de equipo.  
**Prohibido en esta fase:** `kubectl apply|patch|delete|rollout`, Terraform apply/destroy, tocar Sports AWS / Hotel OCI.

## Alcance autorizado (cuando Samuel/Jarrison aprueben)

- Namespace / workload de lab **cine** ya existente para caos de seguridad (p. ej. recursos del experimento), **sin** alterar el flujo multinube productivo.
- Solo variables OTEL de **cine-api** del lab (`OTEL_*_EXPORTER=none` o `OTEL_SDK_DISABLED=true`).
- Heartbeat: `CINE_TELEMETRY_HEARTBEAT_ENABLED=true`.
- Kill switch: archivo `controls/ABORT` en el runner **o** `CINE_TELEMETRY_CHAOS_ABORT=1`.

## Archivos

| Archivo | Uso |
|---------|-----|
| `configmap-otel-inject.overlay.yaml` | Overlay de inyección (exporters off) — **no aplicar** |
| `configmap-otel-baseline.overlay.yaml` | Valores de restore documentados — **no aplicar** |
| `EXPERIMENT_RUNBOOK.md` | Secuencia R0/R1 telemetría con marcas UTC |

## Contención observable → MTTC

1. Runner detecta ALERT → registra `detectedAtUtc` (MTTD).
2. Runner **crea** `seguridad-caos-exp3/controls/ABORT` (o exporta env) → `containedAtUtc` (**MTTC**).
3. Solo después: restore ConfigMap baseline + verificar heartbeats → `telemetryRestoredAtUtc` (**restore_sec ≠ MTTC**).

## Coordinación previa obligatoria

- Ventana de laboratorio y dueño de cluster.
- Confirmar que las réplicas del flujo Sports→Hotel→Cine **no** se usan como target.
- Quién ejecuta apply/rollout y quién observa el kill switch.
- Backup del ConfigMap OTEL actual antes de cualquier cambio.
