# Serie GKE v2 — ejecutada

Estado: **COMPLETADA** (Continuación #8).

| Paso | Estado |
|------|--------|
| Imagen `5.0.1-caos-r1guard-f46e5f4` | Publicada |
| Digest `sha256:8b0172aca858f73c3f3037e95e52418f75fca5b9aae74e1839ec836dd2bfd64b` | OK |
| Rollout Deployment Cine | OK (2/2) |
| Baseline / R0 / R1 | `*-k6-gke-v2.json` |
| Evidencia v1 | Intacta (`*-k6-gke.json`) |
| Restauración 2 réplicas + baseline | OK |

Detalle: `evidencias/LAB_K6_GKE_V2_SUMMARY.md`.

**Hipótesis de throughput R1>R0: NO confirmada** en v2 (−7% RPS vs R0). Bulkhead evidenciado vía `x-reject-reason: bulkhead_timeout`.
