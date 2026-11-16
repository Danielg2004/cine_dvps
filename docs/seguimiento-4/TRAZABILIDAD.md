# Trazabilidad distribuida — API Cine

## Objetivo

Preservar el contexto de correlación cuando Sports (AWS) llama a Cine (GCP).

## Headers soportados

| Header | Rol |
|--------|-----|
| `traceparent` | W3C Trace Context (trace-id + span-id padre) |
| `tracestate` | Vendor state opcional; se hace eco si llega |
| `x-trace-id` | Correlacionador de laboratorio / negocio |

## Reglas

1. Si llega `x-trace-id`, **se conserva**.
2. Si no llega `x-trace-id` pero hay span OTEL válido, se usa `otelTraceId`.
3. Solo si no hay ninguno se genera un UUID.
4. **No** se confunde trace ID con span ID.
5. Las llamadas salientes al cache propagan `x-trace-id` y el contexto W3C vía `propagation.inject`.

## Exportación OTLP

Variables estándar:

- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` / `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL` (`http/protobuf` por defecto)
- `OTEL_SERVICE_NAME` (default `cine-api`)
- `OTEL_SDK_DISABLED=true` para desactivar

## Estado de verificación E2E tres nubes

**No verificado** todavía un trace único Sports → Hotel → Cine en producción.

Verificado localmente:

- Eco de headers en Cine
- Inyección W3C simulada desde Sports
- Tests en `tests/trazabilidad-sports-cine.test.ts`
