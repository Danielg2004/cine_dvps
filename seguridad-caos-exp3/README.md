# Experimento 3 — Ingeniería del Caos de Seguridad (Cine GCP)

Carpeta **independiente** de las evidencias históricas de `docs/seguimiento-4/`.  
No modifica Seguimiento 4 DevOps ni despliegues cloud en esta fase.

## Fases

| Fase | Estado |
|------|--------|
| 1 Detector + R0/R1 diseño + kill switch | Hecha |
| 2 Heartbeat real OTEL + puente local al detector | Hecha |
| 3 Cadena OTLP local → adaptador externo → detector | Hecha |
| 4 Asistente IA aislado + prompt injection R0/R1 | Hecha (harness + **corridas reales Ollama** `llama3.2:3b`) |
| Manifiestos lab GKE aislado `cine-seguridad-exp3` (sin apply) | Preparados en `gke-lab/` (no usa `cine-caos`) |
| Despliegue GKE / corridas R0-R1 telemetría en lab aislado | Pendiente autorización |

**Informe individual:** `INFORME_EXPERIMENTO_3.md`. Evidencias IA: `evidencias-locales/ai-assistant/`.  
**No incluido aún:** apply/rollout GCP, commits (hasta instrucción), Experimento 4 grupal.

## Por qué heartbeat (y no solo tráfico HTTP)

Las métricas HTTP (`http.server.*`) dependen de carga. Un periodo sin requests **no** es falla de telemetría.  
La señal canónica es:

`cine.telemetry.heartbeat`

- Independiente del tráfico de usuarios.  
- El detector solo alerta si ya estuvo **armado** (≥ N heartbeats OK) y luego el silencio supera el umbral.  
- Idle sin heartbeats → `NOT_ARMED` (sin alerta falsa por falta de tráfico).

> **Código listo / GKE pendiente:** el emisor existe en `src/observability/heartbeat.ts` (`CINE_TELEMETRY_HEARTBEAT_ENABLED`). Las pruebas locales usan fixtures + lab OTLP; **no** se inventan lecturas Tempo/Prometheus de cluster.

## Estructura

```
seguridad-caos-exp3/
  detections/          detector + política
  fixtures/            muestras sintéticas (+/-)
  experiments/         diseño R0/R1 telemetría
  ai-assistant/        asistente IA aislado (R0/R1)
  otlp-local/          receptor OTLP + lab cadena
  gke-lab/             overlays GKE — NO APLICAR
  controls/            kill switch (ABORT.example)
  scripts/             verify / inject-detect-contain / AI runs
  evidencias-locales/  OTLP + IA + contención local
  INFORME_EXPERIMENTO_3.md
  REVERSION.md
  METRICAS.md
  RISKS_RESIDUAL.md
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

# Asistente IA (harness; requiere CINE_AI_PROVIDER para modelo real)
npm run security:ai-test

# Contención local con MTTC medible (kill switch ABORT; sin GCP)
node seguridad-caos-exp3/scripts/local-inject-detect-contain.mjs

# Runner R0/R1 telemetría (misma inyección parcial; simulación local)
npm run security:exp3-runner
npm run security:exp3-partial-test
npm run security:exp3-validate-manifests

# Corridas R0/R1 reales (Ollama):
#   set CINE_AI_PROVIDER=ollama
#   set CINE_AI_MODEL=llama3.2:3b
#   npm run security:ai-lab

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
