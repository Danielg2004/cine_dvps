# Entrega a Samuel — observabilidad Cine → OCI

## Collector confirmado

| Campo | Valor |
|-------|--------|
| Endpoint | `https://157.137.233.183:31443` |
| Protocolo | OTLP HTTP/protobuf sobre HTTPS |
| Traces | `/v1/traces` |
| Metrics | `/v1/metrics` |
| Auth | HTTP Basic usuario `otel-lab` |
| CA | `otel-lab-ca.crt` (suministrado por Samuel; no en Git) |
| `OTEL_SERVICE_NAME` | `cine-api` |
| Propagación | W3C `traceparent` / `tracestate` + `x-trace-id` |

Certificado del servidor observado (solo diagnóstico): CN=`hotel-otel-lab`, SAN=`IP:157.137.233.183` + `DNS:otel-lab.local`, autofirmado → requiere CA de confianza.

## Identificadores Cine

| Campo | Valor |
|-------|--------|
| Proyecto GCP | `cine-devops-canary` |
| Namespace | `cine-caos` |
| URL pública | `http://35.239.107.54` |

## Estado de cableado en Cine

- Instrumentación (`src/observability/instrumentation.ts`): OTLP HTTP/protobuf, traces, metrics, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_EXPORTER_OTLP_CERTIFICATE`, W3C.
- Manifiestos: ConfigMap con endpoint/protocolo; volumen `/etc/otel/certs/otel-lab-ca.crt`; Secret `cine-otel-secrets` (headers Basic).
- Script de apply (sin imprimir secretos): `scripts/gcp-apply-otel-oci.ps1`

## Pendiente para activar en GKE

1. Archivo real `otel-lab-ca.crt` de Samuel.
2. Token Basic (canal privado → `OTEL_LAB_TOKEN`).
3. Ejecutar:

```powershell
$env:OTEL_LAB_TOKEN = '<token>'
.\scripts\gcp-apply-otel-oci.ps1 -CaPath 'C:\ruta\otel-lab-ca.crt'
```

4. Confirmación de Samuel en Tempo (traces) y Prometheus (metrics) para `service.name=cine-api`.

**No declarar integración completa solo porque el exporter no reporte errores.**
