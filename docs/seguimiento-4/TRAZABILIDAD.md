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

- `OTEL_EXPORTER_OTLP_ENDPOINT` → collector Samuel OCI `https://157.137.233.183:31443`
- `OTEL_EXPORTER_OTLP_PROTOCOL` (`http/protobuf`)
- `OTEL_EXPORTER_OTLP_CERTIFICATE` → `/etc/otel/certs/otel-lab-ca.crt` (montado desde ConfigMap)
- `OTEL_EXPORTER_OTLP_HEADERS` → `Authorization=Basic%20…` (Secret `cine-otel-secrets`; nunca en Git)
- `OTEL_TRACES_EXPORTER` / `OTEL_METRICS_EXPORTER` = `otlp`
- `OTEL_SERVICE_NAME` (default `cine-api`)
- `OTEL_SDK_DISABLED=true` para desactivar

Apply: `scripts/gcp-apply-otel-oci.ps1` (requiere `otel-lab-ca.crt` + token por canal privado).
Confirmación final: Tempo/Prometheus de Samuel (`service.name=cine-api`).

## Estado de verificación E2E tres nubes

**No verificado** todavía un trace único Sports → Hotel → Cine en producción.

Verificado localmente:

- Eco de headers en Cine
- Inyección W3C simulada desde Sports
- Tests en `tests/trazabilidad-sports-cine.test.ts`
