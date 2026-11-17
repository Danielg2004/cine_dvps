# Pruebas — Continuación #4

**Fecha:** 2026-11-17 UTC (approx.)

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Unitarias | `npm test` | 83/83 OK (tras fix inject OTEL) |
| Typecheck | `npm run typecheck` | OK |
| Kubernetes | `npm run validate:k8s` | OK (kustomize, sin apply) |
| Serie k6 v3 | `npm run chaos:lab:k6` | OK — offered comparable |
| Recuperación | start→stop saturación + healthz/readyz | OK (200) |

## Defectos corregidos en Continuación #4

1. Generador closed-loop → oferta no comparable (documentado; sustituido por k6 open-loop).
2. `K6_DURATION` anulaba `constant-arrival-rate` → variables `CINE_*`.
3. `propagation.inject` manual + UndiciInstrumentation duplicaban `traceparent` → fallaba test OTEL.
4. `POST .../saturation/stop` sin Content-Type → 415 en PowerShell; orquestador corregido.
