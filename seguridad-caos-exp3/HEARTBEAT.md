# Heartbeat OTEL — Fase 2

## Generación (Cine API)

Módulo: `src/observability/heartbeat.ts`  
Arranque: `startTelemetryHeartbeat()` desde `src/observability/instrumentation.ts`.

| Variable | Efecto |
|----------|--------|
| `CINE_TELEMETRY_HEARTBEAT_ENABLED=true\|1` | Activa el intervalo |
| `CINE_TELEMETRY_HEARTBEAT_INTERVAL_MS` | Periodo (default `15000`) |
| `OTEL_SERVICE_NAME` | `service.name` (default `cine-api`) |
| `DEPLOYMENT_ENVIRONMENT` / `APP_TRACK` / `NODE_ENV` | `deployment.environment` |
| `POD_NAME` / `K8S_POD_NAME` / `HOSTNAME` | `service.instance.id` (réplica) |

Métrica: contador OpenTelemetry **`cine.telemetry.heartbeat`**.

Idempotencia: un solo intervalo por proceso (`GLOBAL_STARTED`).  
Apagado: `stopTelemetryHeartbeat()` en SIGINT/SIGTERM/beforeExit y en tests.

## Relación con el detector

El detector (`detections/telemetry-silence-detector.mjs`) **no parsea OTLP**. Solo JSON de muestras.

Cadena local de lab:

```
heartbeat tick
  → counter OTEL (si hay MeterProvider)
  → si export métricas ON: listeners / local-heartbeat-bridge
  → evaluateTelemetrySilence / ByInstance
```

Si `OTEL_METRICS_EXPORTER=none` o `OTEL_SDK_DISABLED=true`: el tick **no** se espeja al puente → el detector (proceso aparte) sigue activo y ve silencio → ALERT.  
Eso modela la inyección R0/R1 sin apagar el detector.

## Réplicas GKE (diseño)

En Autopilot, `HOSTNAME` del contenedor suele ser el nombre del Pod.  
Dos pods ⇒ dos `service.instance.id` ⇒ R1 puede marcar `lossKind=partial|total`.

## Validación local

```bash
npm run security:telemetry-test
npm run security:telemetry-verify
```

**No equivale** a validación en GKE/Tempo/Prometheus.
