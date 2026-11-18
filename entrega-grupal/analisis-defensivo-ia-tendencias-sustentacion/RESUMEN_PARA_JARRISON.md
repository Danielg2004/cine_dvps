# Resumen definitivo para el informe grupal (≤10 páginas)

**Paquete:** `entrega-grupal/analisis-defensivo-ia-tendencias-sustentacion/`  
**Autor del paquete de análisis:** Daniel (Cine GCP) · **Rama:** `feature/seguridad-caos-cine`  
**Actualización Exp4 UTC:** 2026-11-18  
**Estado:** listo para integrar (sin commit/push en este paso)

## 1. Los cuatro experimentos

| # | Tema | Cloud | Responsable | Resultado clave verificado |
|---|------|-------|-------------|----------------------------|
| 1 | Identidad + honeytoken | AWS lab | Jarrison | Honey `identity.honeytoken_use` 403/`allowed=false`; reuse R1 MTTD 398 ms |
| 2 | Segmentación L4 | OCI lab Docker | Samuel | R1 bloqueo+alerta 20 ms; **no** NP OKE |
| 3 | Telemetría parcial + IA | GCP GKE lab | Daniel | R1 partial MTTD 7.51 s / MTTC 148.1 s |
| 4 | Resiliencia datos | OCI VM | Samuel @ `d5e72f6e` | RPO 3.629→2.209 s (−39.1%); RTO 13.056→1.792 s (−86.3%); 10/16→13/16 commits |

## 2. Resultados verificados Exp.4

Fuente: `metrics.json` R0/R1 públicas. Coma decimal ES en docs Samuel.

| | R0 | R1 |
|--|----|----|
| RPO | 3.629 s (3629 ms) | 2.209 s (2209 ms) |
| RTO | 13.056 s | 1.792 s |
| MTTD | 0.300 s | 0.109 s |
| Commits | 10/16 (6 lost) | 13/16 (3 lost) |
| Integridad / recovery | PASS / PASS | PASS / PASS |

G1 = backup mid; G2 = restore automatizado. **n=1**. Integrity PASS **≠** RPO 0.

## 3. Auditoría IA (paquete)

Ollama `llama3.2:3b` real en Exp1–4. Totales humanos ≈ **26 verificadas / 6 incorrectas (controles) / 3 errores de formato**. El LLM no cierra el informe.

## 4. Tendencias (sin inventar nuevas)

| ID | Estado |
|----|--------|
| T1 Honeytoken | Evidenciada en lab AWS (detección local; **no** SIEM) |
| T2 Remediación + aprobación humana | Lab local validado (`cloudTouched=false`) |

## 5. Limitaciones

Labs ≠ prod completa; Exp4 n=1; Exp1 sin SIEM/ts honey; Exp2 no segmenta OKE; Exp3 NS efímero; solo evidencias sanitizadas públicas de Samuel/Jarrison según política de publicación.

## 6. Evidencias / referencias

- Exp1: `evidencias/exp1-aws-jarrison/` + repo grupal `1cad076…`
- Exp2: `evidencias/exp2-samuel/`
- Exp3: `evidencias/exp3-daniel/` + `seguridad-caos-exp3/.../gke-r0-r1-retest`
- Exp4: `evidencias/exp4-samuel/` ← `hotel-fastify` `d5e72f6e`
- IA: `evidencias/ai-runs/*-latest.json`
- Auditoría: `AUDITORIA_CONCLUSIONES_IA.md`
- Guía: `GUIA_SUSTENTACION.md` (4 experimentos + integradoras)

## 7. Qué debe integrar Jarrison

1. Copiar/usar esta carpeta completa en el repo grupal.  
2. Tomar **este** `RESUMEN_PARA_JARRISON.md` como base del capítulo de análisis/tendencias (≤10 pág.).  
3. Citar métricas Exp4 desde `evidencias/exp4-samuel/r0|r1/metrics.json` (commit `d5e72f6e`).  
4. No republicar originales privados de compañeros; usar extractos/sanitizados ya incluidos.  
5. Mantener T1/T2 como están documentadas (sin nuevas tendencias inventadas).

## 8. Guía de sustentación

Completa para Exp1–4 + ≥15 preguntas Exp4 + ≥15 integradoras. Lista para defensa oral individual.
