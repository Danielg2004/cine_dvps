# Evidencia lab local — baseline / R0 / R1

**Fecha (UTC):** 2026-11-16T23:24:56Z  
**Entorno:** in-process (`scripts/chaos/local-inprocess-lab.ts`), sin MySQL/Docker para la medición.  
**Perfil:** concurrency=20, totalRequests=200, holdMs=250, maxInflight saturación=8, admissionMax=3, bulkheadMax=2.

| Ronda | successful_rps | success_rate | rejected 429/503 | p95 ms |
|-------|----------------|--------------|------------------|--------|
| Baseline | 8825.77 | 1.00 | 0 | (sin fallo) |
| R0 | 31.23 | 1.00 | 0 | 765.64 |
| R1 | 5.89 | 0.015 | 197 | 3.42 |

## Interpretación

- El fallo de saturación degrada claramente el baseline (~8826 → ~31 RPS en R0).
- R1 **no** mejora el RPS exitoso del load ofrecido (−81 %), porque admission convierte sobrecarga en 503 (no cuentan como éxito).
- R1 **sí** baja p95 (765 → 3.4 ms) y demuestra rechazos controlados (197×503).
- Hipótesis primaria solo-RPS: **no confirmada**.
- Hipótesis de protección (p95 + 503 controlados): **soportada parcialmente**.

## Archivos locales (gitignored JSON crudos)

- `chaos/results/baseline-local.json`
- `chaos/results/r0.json`
- `chaos/results/r1.json`
- `chaos/results/comparison.json`

Regenerar:

```bash
npx tsx scripts/chaos/local-inprocess-lab.ts
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json
```
