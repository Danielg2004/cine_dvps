# Parada y reversión — lab `cine-seguridad-exp3`

## Kill switch (contención → MTTC)

Aunque falle el runner principal:

1. Crear flag local: `seguridad-caos-exp3/controls/ABORT` **o** `CINE_TELEMETRY_CHAOS_ABORT=1` → `abortRequestedAtUtc`.
2. Contención observable (detiene el silencio adverso) **solo** en `cine-seguridad-exp3`:

```bash
# FUTURO (autorizado) — NO ejecutar ahora
# Local:
node seguridad-caos-exp3/scripts/exp3-containment.mjs --mode=local
# GKE (requiere EXP3_ALLOW_GKE_MUTATION=1):
# kubectl apply -k seguridad-caos-exp3/gke-lab/overlays/contain
```

3. Registrar `containedAtUtc` cuando `CONTAINMENT_ACTIVE=true` esté efectivo.
4. Restore formal (limpia flags + containment) — **sin** `rollout restart`:

```bash
# FUTURO (autorizado) — NO ejecutar ahora
kubectl apply -k seguridad-caos-exp3/gke-lab/overlays/restore
# o patch CM cine-exp3-emitter-b-flags + cine-exp3-containment
# PROHIBIDO: rollout restart (rompe instanceId; ver METODOLOGIA-R1-RESTART-ERROR.md)
```

5. Confirmar `/detector-samples` y detector OK → `telemetryRestoredAtUtc` (**≠ MTTC**).
6. Si el lab debe apagarse por completo:

```bash
# FUTURO — teardown total del namespace de lab (NO toca el namespace DevOps)
kubectl delete namespace cine-seguridad-exp3 --wait=true
```

## Abort de emergencia (máxima prioridad)

```bash
kubectl delete namespace cine-seguridad-exp3 --wait=false
kubectl -n cine-caos get deploy cine-api   # debe seguir 2/2 — solo lectura
```

## Qué no hacer

- No aplicar overlays sobre `cine-caos`.
- No borrar Service/LB `cine-api` de DevOps.
- No usar `restore_sec` como MTTC.
