# Entrega a Samuel — observabilidad Cine → OCI

## Collector

| Campo | Valor |
|-------|--------|
| Endpoint | `https://157.137.233.183:31443` |
| Protocolo | OTLP HTTP/protobuf sobre HTTPS |
| Traces | `/v1/traces` |
| Metrics | `/v1/metrics` |
| Auth | HTTP Basic usuario `otel-lab` |
| CA | `otel-lab-ca.crt` (montado en pods; no en Git) |
| `OTEL_SERVICE_NAME` | `cine-api` |
| Propagación | W3C `traceparent` / `tracestate` + `x-trace-id` |

## Estado Cine (GKE) — activado

- Namespace `cine-caos`, Deployment `cine-api`, **2/2 Ready**
- URL: `http://35.239.107.54`
- ConfigMap: endpoint + protocolo + ruta CA
- Secret `cine-otel-secrets`: `OTEL_EXPORTER_OTLP_HEADERS` (Basic; no en Git)
- ConfigMap `cine-otel-ca`: certificado montado en `/etc/otel/certs/otel-lab-ca.crt`
- Boot pods: `"otlp":"configured"`
- Verificación local TLS+Basic hacia collector: **traces HTTP 200**, **metrics HTTP 200**; sin auth **401**
- Tráfico real generado hacia `GET /api/v2/peliculas/1` con `traceparent` / `x-trace-id`

## Comprobaciones que debe hacer Samuel

### Tempo (trazas)

1. Buscar `service.name = cine-api` (últimos 15–30 min).
2. Confirmar spans HTTP de rutas `/api/v2/peliculas/:id`, `/healthz`, `/readyz`.
3. Verificar propagación W3C: traces con `traceparent` inyectado desde cliente (p. ej. prefijo `aa…` / `ee…` de las pruebas).
4. Confirmar recurso/atributos de servicio `cine-api` (no Hotel).

### Prometheus (métricas)

1. Series con `service_name="cine-api"` / `job` asociado al receiver OTLP.
2. Métricas HTTP / runtime exportadas por el SDK Node (p. ej. contadores/histograma de instrumentación HTTP si están habilitados; además métricas de experimento `cine.experiment.*` si hay carga experimental).
3. Timestamp reciente alineado con las solicitudes de prueba.

### Negativo

- Sin Basic Auth el collector debe responder **401** (ya verificado desde el lado Cine).
- Hotel y Cine deben distinguirse por `service.name`.

**Integración completa solo tras confirmación tuya en Tempo/Prometheus.**
