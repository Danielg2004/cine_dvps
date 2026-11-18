# Guía de sustentación — Exp. 3

## Preguntas esperadas

**¿Por qué no usaron el namespace DevOps?**  
Blast radius: telemetría adversa no debe tocar `cine-caos`, SQL ni LB multinube.

**¿Qué cambió entre R0 y R1?**  
Solo el modo de detección (agregado vs por instancia). Misma inyección parcial.

**¿Por qué la primera R1 falló?**  
`rollout restart` cambió `instanceId`; B nunca armó. Corregido con flags por volumen.

**¿MTTC incluye el restore?**  
No. MTTC = contención efectiva (`CONTAINMENT_ACTIVE`). Restore es métrica aparte.

**¿El LLM decide la alerta?**  
No. El detector es la fuente; el asistente analiza con controles anti-injection.

**¿Quedó algo en el cluster?**  
Namespace lab eliminado; `cine-api` 2/2; LB `35.239.107.54` intacto (última verificación 2026-11-18T17:54Z).

## Demo local rápida (sin GKE)

```bash
npm run security:exp3-validate-manifests
npm run security:exp3-partial-test
npm run security:exp3-emit-gate-test
npm run security:exp3-runner
```
