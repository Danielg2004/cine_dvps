# Resumen ejecutivo para informe grupal (≤2 páginas)

**Paquete:** `entrega-grupal/analisis-defensivo-ia-tendencias-sustentacion/`  
**Autor:** Daniel (Cine GCP) · **Rama:** `feature/seguridad-caos-cine`  
**Actualización Exp1 AWS UTC:** 2026-11-18  
**Fuente AWS:** `JarrisonLopez/defensa-profundidad-caos-2026` @ `1cad076ffed34e70774c3a7dceba941b83660da7`

## Resultados confirmados

**Exp.1 AWS (identidad + honeytoken):** lab ClusterIP+túnel. R0_weak permite reuse (8/0 detecciones). R1_strict deniega reuse (8/8, MTTD reuse **398 ms**). Honeytoken en R0/R1: `identity.honeytoken_use`, HTTP **403**, `allowed=false`, sin grant. **≠** `identity.reuse_detected`. Alertamiento: application securityEvent (**no** CloudWatch/SIEM).

**Exp.2 OCI lab:** Docker+L4; R1 bloqueo+alerta mttd 20 ms; no NP OKE.

**Exp.3 Cine/GCP:** R1 partial MTTD 7.51 s / MTTC 148.1 s; DevOps intacto.

**Exp.4:** pendiente Samuel.

## IA

Ollama `llama3.2:3b` real sobre allowlist; formato JSON separado de factuales; auditoría humana manda. Exp1 run: narrativa coherente; 1 warning `missing_key:claims`.

## Tendencias

| ID | Estado |
|----|--------|
| T1 Honeytoken | **Implementada/evidenciada en lab AWS** (detección local; no SIEM) |
| T2 Remediación + aprobación humana | Lab local validado (no cloud) |

## Limitaciones

Sin SIEM; sin ts/traceId individual honeytoken; no usar MTTD reuse como latencia honeytoken; labs ≠ prod completa; Exp4 ausente.

## Dependencia restante

**Samuel — Exp.4** (RPO/RTO/ransomware).
