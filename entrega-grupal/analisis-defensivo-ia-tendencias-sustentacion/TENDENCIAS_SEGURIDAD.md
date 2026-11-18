# Tendencias de ciberseguridad — Exp1 honeytoken cerrado

**Consulta UTC:** 2026-11-18

## Tendencia 1 — Honeytoken con detección y alerta real

| Aspecto | Estado |
|---------|--------|
| Ficha | `tendencias/honeytoken/FICHA_TECNICA.md` |
| Implementación | Jarrison — Sports/AWS lab |
| Evidencia | Commit `1cad076…` · paquete honeytoken · min↔r1 OK |
| Detección local | **Sí** — `identity.honeytoken_use`, HTTP 403, `allowed=false` |
| Alerta SIEM | **No demostrada** (application securityEvent, not CloudWatch) |
| Relación rúbrica | Tendencia verificable de engaño/detección |
| Diseño / impl / validación | Diseño+impl Jarrison · validación grupal sobre evidencias lab |

**Implementado:** canary + deny + evento.  
**Futuro (no contado como hecho):** SIEM, ts/traceId persistidos, métrica MTTD solo-honeytoken.

## Tendencia 2 — Remediación con aprobación humana

| Aspecto | Estado |
|---------|--------|
| Estado | Instrumentada y validada **localmente** |
| Cloud | **No** — `cloudTouched=false` |
| Evidencias | `evidencias/tendencia-2-human-approval/` |
| Tests | Vitest 6/6 |
