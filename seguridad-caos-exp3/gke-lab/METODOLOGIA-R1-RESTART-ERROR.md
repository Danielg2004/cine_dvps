# Error metodológico — primera ejecución R1 en GKE

**Fecha evidencia original:** 2026-11-18T17:23Z–17:28Z  
**Evidencias intactas (no modificar):** `seguridad-caos-exp3/evidencias-locales/gke-r0-r1/`  
**Addendum técnico:** `.../ADDENDUM-R1-METODOLOGIA.json`

## Qué ocurrió

La inyección parcial se aplicó con:

1. `kubectl patch` de `cine-exp3-emitter-b-flags` (`TELEMETRY_EMIT_ENABLED=false`)
2. **`kubectl rollout restart deploy/cine-exp3-emitter-b`**

El reinicio creó un **nuevo pod** → nuevo `service.instance.id` (`POD_NAME`).  
Ese pod nunca emitió (nació silencioso) → **nunca armó** el detector por instancia.  
R1 evaluó solo `emitter-a` → `alert=false`, `lossKind=none`, `MTTD=null`.

## Qué sí es válido de esa corrida

| Pieza | Estado |
|-------|--------|
| R0 agregado (ceguera parcial) | Válido |
| Contención ABORT / restore / MTTC | Válidos como operación |
| Teardown + DevOps 2/2 + LB | Válidos |
| Hipótesis R1 (ALERT + partial) | **No demostrada** |

## Corrección (código, pendiente de redeploy autorizado)

- Montar `cine-exp3-emitter-b-flags` en `/emit-flags`
- Leer `TELEMETRY_EMIT_ENABLED` / `OTEL_METRICS_EXPORTER` **en cada heartbeat**
- Patch del ConfigMap **sin** `rollout restart`
- Misma `instanceId` armada → silencio → R1 puede alertar `partial`

**No afirmar mejora R1 hasta ALERT real verificable en GKE tras redeploy.**
