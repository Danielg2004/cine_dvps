# Entrega a Samuel — observabilidad Cine GKE

## Identificadores

| Campo | Valor |
|-------|--------|
| `OTEL_SERVICE_NAME` | `cine-api` |
| Negocio | header/body `x-trace-id` / `traceId` |
| W3C | `traceparent`, `tracestate` |
| Proyecto GCP | `cine-devops-canary` |
| Namespace | `cine-caos` |

## Qué se observa hoy

- Logs de Pod (Cloud Logging / `kubectl logs`)
- Probes y eventos K8s
- Métricas de experimento en JSON k6 (`successful_rps`, 503, p95)
- Echo de `x-trace-id` / `traceparent` en respuestas HTTP

## Pendiente

- `OTEL_EXPORTER_OTLP_ENDPOINT` hacia el collector de Samuel (**URL no inventada**)
- Dashboard compartido de throughput / errores / p95 / saturación

Cuando exista el endpoint OTLP, añadir al ConfigMap:

```yaml
OTEL_EXPORTER_OTLP_ENDPOINT: "http://<collector-samuel>:4318"
```
