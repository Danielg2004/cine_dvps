# Métricas del experimento — API Cine

Exportación vía OpenTelemetry (OTLP). Destino compartido (Samuel): **parametrizable**.

## Variables

```bash
export OTEL_SERVICE_NAME=cine-api
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<collector-samuel>:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export EXPERIMENT_ROUND=baseline|r0|r1
```

## Métricas instrumentadas

| Métrica | Tipo | Uso |
|---------|------|-----|
| `http.server.requests` | counter | Throughput / errores HTTP |
| `http.server.errors` | counter | 5xx |
| `http.server.request.duration` | histogram | Latencia → p95/p99 |
| `cine.experiment.requests.successful` | counter | Throughput exitoso del endpoint experimental |
| `cine.experiment.requests.rejected` | counter | Fallos/rechazos experimentales |
| `cine.experiment.admission.rejected` | counter | Rechazos por admisión |
| `cine.experiment.bulkhead.active` | updown | Concurrencia dentro del bulkhead |
| `cine.experiment.inflight` | updown | Solicitudes activas experimentales |
| `cine.experiment.saturation.active` | updown | Sesión de saturación activa |

Atributo común: `experiment.round`.

## Cardinalidad

Se usan plantillas de ruta (`/api/v2/peliculas/:id`), no IDs en atributos.

## Consultas sugeridas (backend OTLP/Prom-compatible)

```promql
# Throughput exitoso
rate(cine_experiment_requests_successful_total[1m])

# Rechazos admisión
rate(cine_experiment_admission_rejected_total[1m])

# Latencia p95 HTTP
histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket[1m])))
```

**No se inventa un dashboard operativo aquí.** Samuel define el tablero compartido.

## Estado

- Generación local de contadores: cubierta por código + tests de resiliencia.
- Exportación a collector compartido: **PENDIENTE** de endpoint de Samuel.
