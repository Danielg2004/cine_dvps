# Informe — Experimento de agotamiento (Daniel / Cine)

Documento listo para integrar al informe académico (máx. 6 páginas).  
Los campos marcados **PENDIENTE** no deben rellenarse con cifras ficticias.

## 1. Objetivo

Evaluar el impacto de una saturación controlada de **concurrencia** sobre el throughput de solicitudes exitosas del endpoint `GET /api/v2/peliculas/:id`, y comparar Ronda 0 (sin protecciones nuevas) frente a Ronda 1 (bulkhead + control de admisión).

## 2. Hipótesis

Si se inyecta saturación de concurrencia sin resiliencia (R0), el throughput exitoso disminuirá respecto al baseline.  
Con bulkhead y admission (R1), bajo el mismo fallo, el throughput exitoso mejorará respecto a R0 y/o se reducirá el impacto de errores no controlados.

## 3. Métrica objetivo

Solicitudes exitosas por segundo (`successful_rps`) en la superficie experimental.

| Indicador | Valor |
|-----------|-------|
| Baseline RPS | PENDIENTE |
| Umbral degradación R0 | PENDIENTE |
| Mejora R1 vs R0 | PENDIENTE |

## 4. Método de inyección

1. Chaos Toolkit: `chaos/experiments/cine-resource-exhaustion.json`
2. Interruptor propio: `POST /api/v3/__test/saturation/start`
3. Intensidad acotada: holdMs ≤ 2000, duration ≤ 120s, inflight ≤ 32
4. Rollback: `POST .../stop` + `/healthz`

## 5. Blast radius

Pods/servicio Cine en namespace `cine-caos`, datos sintéticos. No incluye Sports ni Hotel.

## 6. Resultados

| Ronda | successful_rps | Errores | Notas |
|-------|----------------|---------|-------|
| Baseline | PENDIENTE | PENDIENTE | Sin fallo |
| R0 | PENDIENTE | PENDIENTE | Fallo sin resiliencia |
| R1 | PENDIENTE | PENDIENTE | Fallo + bulkhead/admission |

Comparación automática (cuando existan JSON reales):

```bash
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json
```

## 7. Conclusión preliminar

Implementación local verificada (código, tests, manifiestos, runners).  
Ejecución cloud y cifras experimentales: **pendientes de autorización y medición**.
