# Tendencias de ciberseguridad (sin inventar nuevas)

**Consulta UTC:** 2026-11-18

## Tendencia 1 — Honeytoken

**Estado:** implementada/evidenciada en lab AWS (Jarrison).  
Detección local `identity.honeytoken_use` (403, `allowed=false`).  
**No** SIEM/CloudWatch demostrado.  
Ficha: `tendencias/honeytoken/FICHA_TECNICA.md`.

## Tendencia 2 — Remediación con aprobación humana

**Estado:** instrumentada y validada **localmente**.  
No es remediación cloud (`cloudTouched=false`).  
Evidencias: `evidencias/tendencia-2-human-approval/` · Vitest 6/6.

No se añaden tendencias adicionales no implementadas.
