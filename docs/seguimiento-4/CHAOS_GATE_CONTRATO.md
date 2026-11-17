# Contrato Chaos Gate — participación API Cine

Jarrison implementa el gate compartido. Cine expone este contrato de ejecución.

## Comando reproducible

```bash
export CINE_BASE_URL=http://127.0.0.1:3000
export CHAOS_FAULT_TOKEN='***'
export CINE_PELICULA_ID=1
export EXPERIMENT_ROUND=r0   # o r1 / baseline
export CHAOS_HOLD_MS=200
export CHAOS_MAX_INFLIGHT=4
export CHAOS_DURATION_SEC=30

node scripts/chaos/run-saturation-experiment.mjs > chaos/results/${EXPERIMENT_ROUND}.json
```

Chaos Toolkit (si está instalado en el runner del gate):

```bash
chaos run chaos/experiments/cine-resource-exhaustion.json
```

## Códigos de salida

| Código | Significado |
|--------|-------------|
| 0 | Medición OK + rollback ejecutado |
| 1 | Hipótesis/health no cumplidos |
| 2 | Configuración inválida |
| 3 | Error de ejecución |

## Salida estructurada

JSON con: `experiment_id`, `round`, `during.successful_rps`, `saturation_start`, timestamps.

## Reversión obligatoria

El runner usa `finally` → `POST /api/v3/__test/saturation/stop` + verificación `/healthz`.

## Comparación R0 vs R1

```bash
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json
```

## Integración GitHub Actions (lado Jarrison)

Job sugerido (fragmento):

```yaml
- name: Cine chaos experiment
  env:
    CINE_BASE_URL: ${{ vars.CINE_BASE_URL }}
    CHAOS_FAULT_TOKEN: ${{ secrets.CINE_CHAOS_FAULT_TOKEN }}
    EXPERIMENT_ROUND: r0
  run: node scripts/chaos/run-saturation-experiment.mjs
```

Cine **no** duplica el pipeline multicloud completo.
