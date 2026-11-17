# Perfil k6 — API Cine (Seguimiento #4)

## Perfil fijo `cine-chaos-v3`

| Parámetro | Default | Env |
|-----------|---------|-----|
| Tasa de llegada | 80 iter/s | `CINE_ARRIVAL_RATE` |
| Unidad | 1s | `CINE_TIME_UNIT` |
| Duración | 30s | `CINE_DURATION` |
| preAllocatedVUs | 40 | `CINE_PRE_VUS` |
| maxVUs | 120 | `CINE_MAX_VUS` |
| Endpoint | `GET /api/v2/peliculas/:id` | `CINE_PELICULA_ID` |
| Base URL | `http://127.0.0.1:3000` | `CINE_BASE_URL` |

Executor: **`constant-arrival-rate`** (open-loop).

**No usar** `K6_DURATION`, `K6_VUS`, `K6_ITERATIONS` ni `K6_MAX_VUS` como variables de entorno del proceso: k6 las interpreta como opciones globales y **anulan** el scenario `constant-arrival-rate`.

`dropped_iterations` = k6 no pudo asignar VU a tiempo → **no** es respuesta de la API.

## Ejecución local

```bash
# Servidor con EXPERIMENT_ROUND=baseline|r0|r1 y CHAOS_FAULT_TOKEN
export CINE_BASE_URL=http://127.0.0.1:3000
export CINE_PELICULA_ID=1
export EXPERIMENT_ROUND=r0
export CINE_ARRIVAL_RATE=80
export CINE_DURATION=30s

k6 run load/k6/cine-chaos-profile.js
```

Orquestación Docker (R0/R1 + fallo):

```powershell
npm run chaos:lab:k6
```

## Coordinación con Jarrison

Este archivo es el contrato de carga de Cine. Jarrison puede reutilizar `rate`/`duration`/`headers` en el perfil multicloud sin cambiar la semántica open-loop.
