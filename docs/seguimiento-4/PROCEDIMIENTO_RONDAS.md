# Procedimiento BASELINE / R0 / R1 — API Cine

## Perfil de carga

Jarrison define k6 compartido. Adaptadores Cine:

- Endpoint: `GET /api/v2/peliculas/:id`
- Header: `x-trace-id`, `traceparent`
- Dato sintético: `tests/fixtures/pelicula-sintetica.json`

Variables comunes:

```bash
export CINE_BASE_URL=...
export CINE_PELICULA_ID=...
export CHAOS_FAULT_TOKEN=...
```

## BASELINE

```bash
export EXPERIMENT_ROUND=baseline
export RESILIENCE_ENABLED=false
# Sin saturación
# Ejecutar perfil k6 de Jarrison → guardar métricas reales
```

Estado: **PENDIENTE** de ejecución cloud/k6 real.

## RONDA 0

```bash
export EXPERIMENT_ROUND=r0
# resiliencia forzada OFF por código cuando EXPERIMENT_ROUND=r0
node scripts/chaos/run-saturation-experiment.mjs > chaos/results/r0.json
```

## RONDA 1

```bash
export EXPERIMENT_ROUND=r1
# bulkhead + admission ON
node scripts/chaos/run-saturation-experiment.mjs > chaos/results/r1.json
```

## Comparación

```bash
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json
```

**No generar valores inventados.** Si no hay JSON medido, la comparación falla a propósito.
