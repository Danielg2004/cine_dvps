# Guía de sustentación — cuatro experimentos (etapa 3)

Uso: defensa oral grupal. Donde falte evidencia, la respuesta dice **PENDIENTE** y no inventa cifras.  
Preguntas marcadas **[EVIDENCIA]** exigen archivo; **[CONCEPTO]** se responden sin Exp1/Exp4.  
**Auditoría IA etapa 3:** Exp3 = 7 verificadas; Exp2 = 4 verificadas + 1 incorrecta (control NP OKE) + 1 error de formato aparte (no alucinación).

---

## 1. Defensa en profundidad

**P:** ¿Qué es defensa en profundidad en este proyecto?  
**R:** Capas independientes (identidad, red, detección, contención, recuperación, análisis) de modo que el fallo de una no anula el resto. Ejemplo: Exp3 combina NetPol lab + detector + ABORT + teardown sin tocar DevOps.

## 2. Zero Trust y NIST SP 800-207

**P:** ¿Cómo se relaciona Zero Trust con los labs?  
**R:** SP 800-207 exige decisión continua sobre recursos, no confianza perimetral única. Exp2 deniega path no autorizado en L4 (lab); Exp3 niega egress/ingress salvo allowlist. Identidades de máquina de lab ≠ identidades DevOps.

## 3. Identidad de máquina

**P:** ¿Por qué importa `service.instance.id` en Exp3? **[EVIDENCIA]**  
**R:** El detector por instancia arma y mide silencio por identidad. Un `rollout restart` cambió el id e invalidó R1; flags por volumen preservan identidad (`…-s9ndm`). Evidencia: ADDENDUM + FINAL-REPORT retest.

## 4. Segmentación / microsegmentación

**P:** ¿Exp2 demostró NetworkPolicy en OKE? **[EVIDENCIA]**  
**R:** **No.** Lab Docker aislado; no sustituye controles OCI prod. Evidencia: README Exp2 / summaries públicos.

## 5. SOC, SIEM y detección como código

**P:** ¿Qué es detección como código aquí?  
**R:** Reglas/políticas versionadas + evaluadores reproducibles (detector telemetría JSON; reglas unauthorized_deny Exp2) con evidencias UTC.

## 6. MITRE ATT&CK / D3FEND / ATLAS

**P:** ¿Mapeos usados?  
**R:** T1562.001 (impair defenses/telemetría), D3-SYSM/D3-PM, ATLAS AML.T0051 (prompt injection). Ver informes Exp3 y docs Exp2.

## 7. MTTD, MTTC, R0/R1, cobertura y FP

**P:** Diferencia R0 vs R1. **[EVIDENCIA]**  
**R:** R0 = baseline (control débil o ausente). R1 = control mejorado. Exp3: R0 agregado no ve pérdida parcial; R1 por instancia sí. Exp2: R0 permisivo sin detección; R1 bloquea+alerta.

**P:** MTTD vs MTTC vs restore.  
**R:** MTTD = detección − inyección efectiva; MTTC = contención efectiva − inyección; **restore ≠ MTTC**. Exp3 R1: MTTD 7.51s, MTTC 148.1s, restore 118.0s. Exp2 R1: mttd_ms=20; contención **preventive** (no MTTC reactivo clásico).

**P:** Cobertura y falsos positivos Exp3.  
**R:** R0 coverage 0; R1 coverage 1; FP pre-inyección 0 (FINAL-REPORT).

## 8. RPO y RTO — **[CONCEPTO / PENDIENTE Exp4]**

**P:** ¿Definición RPO/RTO?  
**R:** RPO = pérdida de datos tolerable; RTO = tiempo para restaurar servicio. **Mediciones del grupo: PENDIENTE Exp. 4 (Samuel).**

## 9. Resiliencia ransomware — **[CONCEPTO / PENDIENTE Exp4]**

**P:** ¿Evidencia grupal de ransomware?  
**R:** **PENDIENTE Exp. 4.** Concepto: backups inmutables, restore probado, RPO/RTO medidos.

## 10. IA defensiva y por qué falla

**P:** ¿El LLM decide alertas?  
**R:** No. El detector es autoridad; el asistente analiza con contexto untrusted + validación.

**P:** ¿Por qué el LLM puede concluir mal? **[EVIDENCIA etapa 3]**  
**R:** (1) Puede ignorar el contrato JSON o omitir keys; (2) puede truncar/anidar mal; (3) puede inventar cifras; (4) puede confundir lab con producción. **Importante:** un error de formato JSON **no** es automáticamente una alucinación factual — se registra en `formatErrors`. Etapa 3 Exp2: JSON parseable con warning `missing_key:claims`; factual coherente con Docker/L4; el anti-patrón “NP OKE” queda como incorrecto deliberado.

## 11. Aprobación humana (Tendencia 2) — preguntas difíciles

**P:** ¿Cómo demuestran que la acción no corre antes del approve?  
**R:** `proposeRemediation` deja `executed=false` y `PROPOSAL_PENDING.json`; `runRemediationGate` solo escribe el flag tras `decision=approve` + aprobador allowlisted. Tests: reject/absent/unverified → `executed=false`.

**P:** ¿Qué pasa si el aprobador no está autorizado?  
**R:** `approver_not_authorized`; no hay flag. Evidencia: test + runs en `evidencias/tendencia-2-human-approval/`.

**P:** ¿Esto remedió GCP?  
**R:** **No.** Lab local; `cloudTouched=false`; sin kubectl/terraform.

## 12. Tendencias

**P:** ¿Honeytoken? → **PENDIENTE Jarrison** (ficha en `tendencias/honeytoken/FICHA_TECNICA.md`).  
**P:** ¿Remediación human-in-the-loop? → Lab local demostrado + 6 tests; no cloud.

## 13. Limitaciones

Labs ≠ prod completa; Exp2 no arregla OKE; Exp3 NS efímero; Exp1/4 incompletos aquí; LLM alucina/formatea mal → auditoría humana obligatoria.

---

## Preguntas por experimento

### Exp. 1 (Jarrison) — PENDIENTE
**P:** ¿Métricas Sports? → **PENDIENTE** de su paquete/URL.

### Exp. 2 (Samuel / OCI lab) — EVIDENCIA PÚBLICA
**P:** ¿R0 vs R1? → R0 acceso no auth permitido sin detección; R1 bloquea+alerta (summaries `742c575a`, 2026-11-18).  
**P:** ¿MTTC reactivo? → No; `containment_class=preventive`.  
**P:** ¿Fue NetworkPolicy en OKE? → **No.** Docker + gateway L4; producción OKE no modificada.

### Exp. 3 (Daniel / Cine GCP) — EVIDENCIA COMPLETA
**P:** ¿Mejora R1? → Sí en retest GKE (ALERT partial, mismo instanceId). Primera R1 con restart: inválida.  
**P:** ¿MTTD/MTTC? → 7.51s / 148.1s (retest).

### Exp. 4 (Samuel) — PENDIENTE
**P:** ¿RPO/RTO logrados? → **PENDIENTE.** Preguntas de AWS/recuperación quedan como **guía conceptual** hasta exista evidencia.
