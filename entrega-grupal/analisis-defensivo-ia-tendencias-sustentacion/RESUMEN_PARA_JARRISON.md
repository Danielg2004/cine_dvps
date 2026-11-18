# Resumen ejecutivo para informe grupal (≤2 páginas)

**Paquete:** `entrega-grupal/analisis-defensivo-ia-tendencias-sustentacion/`  
**Autor:** Daniel (Cine GCP) · **Rama:** `feature/seguridad-caos-cine`  
**Cierre auditoría etapa 3 UTC:** 2026-11-18  
**Listo para integrar** (sin commit desde este chat hasta autorización).

## Resultados confirmados

**Exp. 3 (Cine/GCP):** pérdida parcial de telemetría. R0 agregado no alerta (cobertura 0). R1 por instancia alerta `partial` (cobertura 1), MTTD **7.51 s**, MTTC **148.1 s**, FP pre-inyección 0, identidad B estable, lab eliminado, DevOps 2/2. R1 histórica con restart = inválida.

**Exp. 2 (Hotel/OCI lab, Samuel @ `742c575a`):** lab **Docker + gateway L4** (no NetworkPolicy OKE). R0 sin detección observada. R1 `VALID_R1`: bloqueo + alerta, MTTD **20 ms**, contención **preventive**.

**Exp. 1 / Exp. 4:** sin evidencias en este paquete → no se inventan resultados.

## Valor aportado por la IA

- Narrativa defensiva reproducible con Ollama `llama3.2:3b` real sobre evidencias allowlisted.  
- Conserva prompt, parámetros, respuesta **cruda intacta**, timestamps UTC.  
- Fuerza contraste humano: el LLM **no** es fuente de verdad.  
- Etapa 3 separa **errores de formato JSON** de **alucinaciones factuales**.

## Errores y alucinaciones identificados

| Tipo | Hallazgo |
|------|----------|
| Formato (Exp2 etapa 2) | JSON truncado/mal anidado; mal clasificado antes como “incorrecta” factual → **corregido** |
| Formato (Exp2 etapa 3) | JSON válido con warning `missing_key:claims` (**1** error de formato, no alucinación) |
| Factual incorrecta | Control negativo: “equivale a NP OKE” = **incorrecta**; Samuel no aplicó NP OKE |
| Pendientes | Exp1/Exp4 = no verificables por ausencia de fuente |

**Conteo factual auditado:** Exp3 **7** verificadas; Exp2 **4** verificadas + **1** incorrecta (control); **2** no verificables (Exp1+4); **1** error de formato aparte.

## Tendencias

| ID | Estado |
|----|--------|
| T1 Honeytoken + alerta real | **Pendiente** de evidencias originales de Jarrison |
| T2 Remediación + aprobación humana | **Instrumentada y validada en lab local** (no cloud): detección→propuesta→approve/reject→flag→verify→revert; Vitest 6/6; `cloudTouched=false` |

## Evidencias disponibles en el paquete

- `evidencias/exp3-daniel/`, allowlist → `seguridad-caos-exp3/.../gke-r0-r1-retest/`  
- `evidencias/exp2-samuel/` (summaries sanitizados)  
- `evidencias/ai-runs/` (historial + latest etapa 3 Exp2)  
- `evidencias/tendencia-2-human-approval/`  
- Docs: matriz, análisis, auditoría, tendencias, guía, este resumen  

## Dependencias faltantes

1. **Jarrison:** URL/paquete Exp.1 + honeytoken (activación, alerta UTC, prueba negativa).  
2. **Samuel:** Exp.4 (RPO/RTO/ransomware).  
3. Confirmación de reutilización del honeytoken como tendencia grupal.
