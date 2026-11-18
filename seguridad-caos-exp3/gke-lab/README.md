# Laboratorio GKE aislado — `cine-seguridad-exp3`

**Clúster:** `cine-caos-autopilot` / `cine-devops-canary`.  
**Prohibido:** tocar `cine-caos`, LB `35.239.107.54`, Cloud SQL, GSA DevOps, collector OCI.

## Arquitectura

```
Namespace cine-seguridad-exp3
  ├─ cine-exp3-otlp-receiver (ClusterIP :4319)
  ├─ cine-exp3-emitter-a
  ├─ cine-exp3-emitter-b  (/emit-flags ← cine-exp3-emitter-b-flags, sin restart)
  ├─ /containment ← cine-exp3-containment (ABORT)
  ├─ NetworkPolicy default-deny + DNS + OTLP lab
  └─ ResourceQuota (0 LoadBalancers)
```

## Inyección parcial (R0 = R1)

**Patch del ConfigMap montado** → el emisor relee flags en cada heartbeat.  
**PROHIBIDO** `rollout restart` para inject/restore (rompe `service.instance.id`; invalidó la 1ª R1).  
Ver `METODOLOGIA-R1-RESTART-ERROR.md` y `PROCEDURE-R1-RETEST.md`.

| Overlay / acción | Efecto |
|------------------|--------|
| `overlays/inject-partial` o patch flags `false`/`none` | B silent, A OK |
| `overlays/contain` | `CONTAINMENT_ACTIVE=true` fuerza emit |
| `overlays/restore` | flags OK + containment false |

## Validación local

```bash
node seguridad-caos-exp3/gke-lab/validate-local.mjs
npm run security:exp3-partial-test
npx vitest run tests/seguridad-caos-exp3-emit-gate-stable-id.test.ts
```
