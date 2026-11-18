# Guía de sustentación — cuatro experimentos (con Exp.1 AWS)

Uso: defensa oral grupal. Donde falte evidencia: **PENDIENTE** (no inventar).  
**[EVIDENCIA]** = archivo; **[CONCEPTO]** = sin necesitar Exp4.

**Auditoría IA actual:** Exp1 = 7 verificadas + 2 incorrectas (controles) + 1 error formato; Exp2 = 4+1+formato; Exp3 = 7; Exp4 pendiente.

---

## 1. Defensa en profundidad

**P:** ¿Qué es defensa en profundidad aquí?  
**R:** Capas independientes (identidad, red, detección, contención, recuperación, análisis). Ej.: honeytoken + política reuse (Exp1); NetPol+detector+ABORT (Exp3); HITL local (T2).

## 2. Zero Trust / NIST SP 800-207

**P:** ¿Cómo aplica Zero Trust?  
**R:** Decisión continua sobre identidad/recurso. Exp1 evalúa cada invoke de machine-token; Exp2 deniega path L4 no autorizado; Exp3 niega tráfico fuera de allowlist lab.

## 3. Identidad de máquina

**P:** ¿Qué se midió en Exp1? **[EVIDENCIA]**  
**R:** Emisión/invoke de tokens de máquina; R0_weak vs R1_strict ante **reuse**; honeytoken canary con deny. Fuente: r0/r1 @ `1cad076`.

**P:** ¿`service.instance.id` en Exp3? **[EVIDENCIA]**  
**R:** Identidad estable necesaria para silencio por instancia; restart invalidó R1 histórica.

## 4. Segmentación

**P:** ¿Exp2 = NetworkPolicy OKE? → **No.** Docker + gateway L4.

## 5. SOC / SIEM / detección como código

**P:** ¿El honeytoken generó alerta SIEM? **[EVIDENCIA]**  
**R:** **No demostrado.** `alertingMechanism` = application securityEvent (**not CloudWatch**). Hay evento local `identity.honeytoken_use`.

## 6. ATT&CK / D3FEND / ATLAS

Mapeos de telemetría/IA en Exp3; identidad/canary en Exp1 como detección por engaño. No forzar IDs no documentados.

## 7. MTTD / MTTC / R0-R1

**P:** ¿MTTD 398 ms del Exp1 es del honeytoken? **[EVIDENCIA]**  
**R:** **No.** Es de la ronda de **reuse** en R1. El honeytoken no tiene latencia individual persistida.

**P:** R0 vs R1 Exp1?  
**R:** R0 permite reuse (8 allowed, 0 detections); R1 deniega (8 denied, 8 detections). Honeytoken deny en ambas.

## 8. Cobertura / FP

Exp1 R1: coverage 100%, FP 0 (reuse). Exp3: R0 coverage 0 / R1 1; FP pre-inyección 0.

## 9–10. RPO/RTO / ransomware — **[CONCEPTO / PENDIENTE Exp4]**

Sin mediciones grupales aún.

## 11. IA defensiva

**P:** ¿Por qué puede fallar el LLM?  
**R:** Formato JSON, confusión honeytoken↔reuse, inventar SIEM/ts. Por eso auditoría humana y `formatErrors` separados.

## 12. Honeytokens — preguntas difíciles

**P:** ¿`identity.honeytoken_use` = `identity.reuse_detected`?  
**R:** **No.** Canary vs reuse de token legítimo-firmado mal reutilizado.

**P:** ¿Hubo acceso concedido con honeytoken?  
**R:** **No.** HTTP 403, `allowed=false`, `honeytokenGrantsAccess=false`.

**P:** ¿Podemos citar el timestamp exacto del invoke honey?  
**R:** **No** está en `events[]`; no inventarlo. Solo ventanas `startedAt`/`endedAt` de la ronda.

**P:** ¿Es producción AWS?  
**R:** Lab aislado ClusterIP+túnel; regla SSH temporal revocada.

## 13. Tendencias / limitaciones

T1 honeytoken: evidenciada en lab (no SIEM). T2 HITL: lab local. Limitaciones: labs≠prod; Exp4 pendiente; sin ts honeytoken.

## Por experimento

### Exp.1 AWS — EVIDENCIA
Honeytoken 403 + evento canary; reuse R0/R1 contrastados; sin SIEM.

### Exp.2 OCI — EVIDENCIA pública
R0 permisivo; R1 bloqueo+alerta 20 ms; no OKE NP.

### Exp.3 Cine — EVIDENCIA
R1 partial 7.51 s / 148.1 s; identidad estable en retest.

### Exp.4 — PENDIENTE Samuel
RPO/RTO/ransomware.
