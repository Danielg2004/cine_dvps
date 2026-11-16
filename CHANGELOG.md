# Changelog

## [5.0.0] - 2026-03-16

### Added

- Contrato multicloud Sports→Cine (`GET /api/v2/peliculas/:id`) y documentación.
- Trazabilidad W3C (`traceparent`/`tracestate`) + correlación `x-trace-id`.
- Probes `/healthz` y `/readyz` para Kubernetes.
- Manifiestos GKE en `deploy/gcp/k8s/` (2 réplicas, probes, resources, ConfigMap/Secret).
- Guía compartida `docs/seguimiento-4/VALIDACION_KUBERNETES.md`.
- Experimento de saturación de concurrencia (Chaos Toolkit + interruptor propio).
- Bulkhead y control de admisión con modos baseline/R0/R1.
- Métricas OTEL del experimento y contrato para chaos gate.
- Runners `scripts/chaos/*` y comparador de rondas.
- Documentación Seguimiento #4.

### Changed

- Cache cliente: sin IP hardcodeada; degradación ante fallos; propagación OTEL.

### Notes

- Despliegue real GKE, baseline/R0/R1 cloud y umbrales medidos: pendientes de autorización/ejecución.

## [4.0.0] - previo

Canary GCP Cloud Run, quality gates y fault drill V4 (ver README histórico).

## [1.0.0] - previo

API base cine + entregas anteriores.
