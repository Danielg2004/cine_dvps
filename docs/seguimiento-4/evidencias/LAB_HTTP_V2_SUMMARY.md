# Evidencia serie v2 — HTTP ventana fija (Docker local)

**Fecha (UTC):** 2026-11-16T23:44:12Z  
**Serie:** `v2-http-fixed-window`  
**Método:** carga sostenida 20 workers × 6 s contra Compose (`cine-lab-s4`).  
**Fallo idéntico R0/R1:** holdMs=250, maxInflight=8, maxQueueWaitMs=200.  
**Resiliencia R1:** admission=8, bulkhead=8 (alineados a la capacidad del fallo).

> La serie v1 (in-process, lote cerrado) se conserva en `LAB_LOCAL_SUMMARY.md` y **no debe mezclarse**.

## Resultados

| Ronda | successful_rps | success_rate | rejected 503 | success p95 ms |
|-------|----------------|--------------|--------------|----------------|
| Baseline | **1592.83** | 1.00 | 0 | 19.17 |
| R0 | **33.33** | 0.4065 | 292 | 340.18 |
| R1 | **32.00** | 0.0065 | 29304 | 268.89 |

Comparación R1 vs R0:

- Δ RPS: **−1.33 (−4.0 %)** → dentro de ±15 % (capacidad sostenida equivalente al cuello de saturación ≈ 8/0.25 s).
- p95 de éxitos: **mejora** 340 → 269 ms.
- R1 convierte sobrecarga en **503 controlados** (no cuentan como éxito).
- R0 también degrada (éxito ~41 %) por `saturation_queue_timeout`.

## Conclusión de hipótesis

- **Hipótesis “R1 aumenta RPS exitoso”:** **NO CONFIRMADA** (R1 ≈ R0, −4 %).
- **Hipótesis de resiliencia (sostener capacidad del recurso + shed controlado):** **SOPORTADA PARCIALMENTE**.

Esto es coherente con teoría: el throughput exitoso máximo bajo el fallo está acotado por `maxInflight/holdMs`; admission no crea capacidad, evita colas destructivas.

## Artefacto in-process descartado para v2 oficial

El lab in-process con 503 instantáneos inundaba el event loop compartido y subestimaba R1 (~0.3 RPS). Por eso la serie oficial v2 es **HTTP en proceso separado**.

## Regenerar

```powershell
npm run chaos:lab:http
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json
```
