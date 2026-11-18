# Experimento 3 — Ingeniería del Caos de Seguridad (Cine GCP)

Carpeta **independiente** de las evidencias históricas de `docs/seguimiento-4/`.  
No modifica Seguimiento 4 DevOps ni despliegues cloud en esta fase.

## Fases

| Fase | Estado |
|------|--------|
| 1 Detector + R0/R1 diseño + kill switch | Hecha |
| 2 Heartbeat real OTEL + puente local al detector | Hecha |
| 3 Cadena OTLP local → adaptador externo → detector | Hecha |
| Despliegue GKE / R0-R1 reales / capa IA | Pendiente autorización |

**No incluido aún:** componente de IA, corridas reales en GCP, commits, cambios de ConfigMap desplegado.

## Por qué heartbeat (y no solo tráfico HTTP)

Las métricas HTTP (`http.server.*`) dependen de carga. Un periodo sin requests **no** es falla de telemetría.  
La señal canónica es:

`cine.telemetry.heartbeat`

- Independiente del tráfico de usuarios.  
- El detector solo alerta si ya estuvo **armado** (≥ N heartbeats OK) y luego el silencio supera el umbral.  
- Idle sin heartbeats → `NOT_ARMED` (sin alerta falsa por falta de tráfico).

> **Dependencia pendiente:** emitir este heartbeat desde `cine-api` en runtime (intervalo estable). Hoy el detector y las pruebas usan **muestras sintéticas**; no se inventan lecturas Tempo/Prometheus.

## Estructura

```
seguridad-caos-exp3/
  detections/     detector + política
  fixtures/       muestras sintéticas (+/-)
  experiments/    diseño R0/R1 (DESIGN_ONLY)
  controls/       kill switch (ABORT.example)
  scripts/        verify-kill-switch.mjs
  REVERSION.md
  METRICAS.md
  README.md
```

## Cómo probar en local

```bash
# Detector + heartbeat + cadena OTLP
npm run security:telemetry-test

# Lab OTLP end-to-end + evidencias UTC
npm run security:otlp-lab

# Kill switch (sin GCP)
npm run security:telemetry-verify

# Detector CLI — negativa / positiva (fixtures)
node seguridad-caos-exp3/detections/telemetry-silence-detector.mjs \
  --samples seguridad-caos-exp3/fixtures/samples-negative-healthy.json \
  --policy seguridad-caos-exp3/detections/telemetry-silence-policy.json \
  --now 2026-11-18T02:01:45.000Z

node seguridad-caos-exp3/detections/telemetry-silence-detector.mjs \
  --samples seguridad-caos-exp3/fixtures/samples-positive-silence.json \
  --policy seguridad-caos-exp3/detections/telemetry-silence-policy.json \
  --now 2026-11-18T02:03:00.000Z
```

Detalle del emisor: `HEARTBEAT.md`.

## Inyección prevista (misma en R0 y R1)

Deshabilitar export OTEL (`OTEL_TRACES_EXPORTER=none`, `OTEL_METRICS_EXPORTER=none` o `OTEL_SDK_DISABLED=true`), alineado con toggles ya existentes en `src/observability/instrumentation.ts`.  
**No ejecutado** en esta fase.

Detalle: `experiments/cine-telemetry-loss.design.json`, `METRICAS.md`, `REVERSION.md`.
