# Informe comparativo definitivo — Exp. 3 R0/R1 (GKE, inyección por volumen)

**Completado UTC:** 2026-11-18T17:54:14Z  
**Evidencias esta corrida:** `seguridad-caos-exp3/evidencias-locales/gke-r0-r1-retest/`  
**Evidencias corrida inválida R1 (restart):** `.../gke-r0-r1/` — **conservadas intactas**

## Hipótesis

Misma inyección parcial (B silent / A OK) **sin** `rollout restart`:

| Ronda | Detector | Esperado | Resultado |
|-------|----------|----------|-----------|
| R0 | agregado | sin ALERT | **sin ALERT** ✓ |
| R1 | por instancia | ALERT + `partial` | **ALERT + partial** ✓ |

## Identidad estable

`emitter-b` = `cine-exp3-emitter-b-7db5b8946b-s9ndm` en inject, contain y restore (R0 y R1).

## Métricas (GKE reales)

| Métrica | R0 | R1 |
|---------|----|----|
| ALERT | false | **true** |
| lossKind | — | **partial** |
| MTTD_sec | **null** (no detectado) | **7.510** |
| MTTC_sec | 182.696 | 148.071 |
| restore_sec | 77.414 | 118.023 |
| Cobertura | 0 | **1** |
| FP pre-inject | 0 | 0 |

`detectedAtUtc` (R1) = último OK de B + umbral 60s = `2026-11-18T17:48:38.517Z`  
`faultInjectedAtUtc` = `2026-11-18T17:48:31.007Z`  
`containedAtUtc` (verificado) ≠ abort/apply.

## Contención / restore

Verificados en ambas rondas. R1: restore final confirmado manualmente tras corte transient de kubectl (detección/contain ya persistidos).

## Teardown / DevOps

- Namespace eliminado (`NotFound`)
- Sin residuales `cine-exp3`
- `cine-api` **2/2** · LB **35.239.107.54**

## Conclusión

**Experimento 3 individual (telemetría R0/R1 en GKE): terminado.**  
Mejora verificable: R0 ciego a pérdida parcial; R1 alerta `partial` sobre el **mismo** `instanceId` armado.
