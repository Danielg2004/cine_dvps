# Cadena OTLP local — Exp. 3

## Arquitectura

```
cine-api / lab MeterProvider
  → OTLPMetricExporter (HTTP JSON) POST /v1/metrics
  → otlp-http-receiver.mjs  (receptor local)
  → heartbeat-samples.jsonl + sample store (ventana maxAgeSec)
  → otlp-external-adapter.mjs  (proceso independiente)
  → telemetry-silence-detector (OK | ALERT | partial/total)
```

- La prueba de recepción usa el **contador de POST OTLP**, no `subscribeTelemetryHeartbeat`.
- Series históricas se filtran con `maxAgeSec` en `otlp-sample-store`.
- Opcional: `otel-collector-config.yaml` si tienes `otelcol-contrib` (HTTP :4318, JSON+protobuf).

## Comandos

```bash
# Lab end-to-end + evidencia UTC
npm run security:otlp-lab

# Tests automatizados (incluye cadena OTLP)
npm run security:telemetry-test
npm run typecheck
```

## Evidencias locales

Tras el lab:

- `seguridad-caos-exp3/evidencias-locales/otlp-chain-lab-result.json`
- `.../otlp-chain-negative-report.json`
- `.../otlp-chain-positive-report.json`
- `.../otlp-chain-restore-report.json`

Runtime del receptor (gitignored): `otlp-local/out/`.

### Métricas del lab

- **MTTD** y **restore_sec**: medidos con marcas UTC explícitas.
- **MTTC de contención operativa**: **no** validado aquí (`MTTC_sec_validated_containment: null`). El script solo marca un ack post-ALERT; ver `METRICAS.md`.
