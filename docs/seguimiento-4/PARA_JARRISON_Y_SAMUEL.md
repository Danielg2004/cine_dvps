# Entrega a Jarrison (Sports/k6) y Samuel (Hotel/dashboard)

## Para Jarrison

1. **Perfil de carga Cine (contrato):** `load/k6/cine-chaos-profile.js` + `load/k6/README.md`
   - Executor: `constant-arrival-rate`
   - Defaults: 80/s, 30s, 40–120 VUs
   - Env: `CINE_ARRIVAL_RATE`, `CINE_DURATION`, `CINE_PRE_VUS`, `CINE_MAX_VUS` (evitar `K6_DURATION`/`K6_VUS`)
   - Endpoint: `GET /api/v2/peliculas/:id`
   - Headers: `x-trace-id`, `traceparent`
2. **Misma intensidad R0/R1:** no cambiar rate/duration entre rondas.
3. **Métricas a reportar:** offered HTTP, dropped_iterations (separadas), successful_rps, success_rate, 503, 429, p95 de éxitos.
4. **Serie local Cine (referencia):** `docs/seguimiento-4/evidencias/LAB_K6_V3_SUMMARY.md`
5. **Gate:** hipótesis de RPS **no confirmada** localmente; gate no debe exigir mejora de RPS como condición de merge sin evidencia cloud.

## Para Samuel

1. Trace: `x-trace-id` + W3C `traceparent` en respuestas Cine (ver `TRAZABILIDAD.md`).
2. OTEL service name lab: `cine-api`; export OTLP pendiente de endpoint del tablero.
3. Códigos bajo caos: 200 (éxito), 503 (admission/saturación), no maquillar rechazos.
4. Series JSON: `chaos/results/*-k6-v3.json` para overlay R0/R1 cuando el dashboard consuma evidencias.

## Pendiente compartido (no hecho)

- URL pública Cine en GKE
- Corrida k6 contra GCP
- E2E Sports→Hotel→Cine con el mismo trace
