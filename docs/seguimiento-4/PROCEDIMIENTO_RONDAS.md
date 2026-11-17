# Procedimiento BASELINE / R0 / R1 — API Cine

## Perfil de carga oficial (local y futuro GCP)

Contrato versionado para coordinación con Jarrison:

- Script: `load/k6/cine-chaos-profile.js`
- Executor: `constant-arrival-rate` (open-loop)
- Defaults: 80 iter/s, 30s, preAllocatedVUs=40, maxVUs=120
- Endpoint: `GET /api/v2/peliculas/:id`
- Headers: `x-trace-id`, `traceparent`
- Env del perfil: `CINE_ARRIVAL_RATE`, `CINE_DURATION`, `CINE_PRE_VUS`, `CINE_MAX_VUS`
- **No usar** `K6_DURATION` / `K6_VUS` (anulan el scenario)

Variables comunes:

```bash
export CINE_BASE_URL=http://127.0.0.1:3000
export CINE_PELICULA_ID=1
export CHAOS_FAULT_TOKEN=...
export CINE_ARRIVAL_RATE=80
export CINE_DURATION=30s
```

## Orquestación local Docker (serie v3)

```powershell
npm run chaos:lab:k6
```

Equivale a baseline → r0 → r1 con el mismo perfil k6 y el mismo fallo en R0/R1.

## BASELINE

```bash
export EXPERIMENT_ROUND=baseline
# Sin saturación
k6 run load/k6/cine-chaos-profile.js
# → chaos/results/baseline-k6-v3.json
```

Estado local: **ejecutado** (2026-11-17 UTC). Cloud: pendiente.

## RONDA 0

```bash
export EXPERIMENT_ROUND=r0
# resiliencia OFF por código
# Activar saturación HTTP, luego:
k6 run load/k6/cine-chaos-profile.js
```

## RONDA 1

```bash
export EXPERIMENT_ROUND=r1
# bulkhead + admission ON
# Misma saturación y mismo perfil k6
k6 run load/k6/cine-chaos-profile.js
```

## Comparación

```bash
node scripts/chaos/compare-rounds.mjs chaos/results/r0-k6-v3.json chaos/results/r1-k6-v3.json
```

**No generar valores inventados.** `dropped_iterations` son del scheduler k6, no respuestas API.

## GCP (cuando autoricen)

1. Desplegar manifiestos `deploy/gcp/k8s` (Autopilot).
2. Exponer Service/Ingress.
3. Ejecutar el **mismo** perfil k6 apuntando a la URL pública.
4. Guardar JSON en `chaos/results/` con sufijo `-gcp`.
5. No declarar experimento cloud terminado hasta tener esos JSON.
