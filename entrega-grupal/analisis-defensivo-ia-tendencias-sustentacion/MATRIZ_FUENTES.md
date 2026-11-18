# Matriz de fuentes — etapa 3

**Actualización UTC:** 2026-11-18T18:22:46Z (re-run Exp2 + auditoría formato)  
**Regla:** sin URL inventada; sin métricas inventadas.

| ID | Experimento | Responsable | Disponibilidad | Identificador / ruta | Fecha evidencia | Notas |
|----|-------------|-------------|----------------|----------------------|-----------------|-------|
| EXP3-GKE-VALID | Exp. 3 Telemetría R0/R1 GKE | Daniel | **DISPONIBLE** | `../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1-retest/FINAL-REPORT.json` | 2026-11-18T17:54:14Z | Corrida válida (volumen, identidad estable) |
| EXP3-GKE-HIST | Exp. 3 R1 histórica inválida | Daniel | **DISPONIBLE** | `../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1/` | 2026-11-18 | Conservada; no usar como mejora |
| EXP3-IA-IND | Exp. 3 IA individual | Daniel | **DISPONIBLE** | `../../seguridad-caos-exp3/evidencias-locales/ai-assistant/` | 2026-11-18 | Ollama individual Exp3 |
| EXP3-AI-GRP | Análisis grupal Exp3 | Daniel | **DISPONIBLE** | `evidencias/ai-runs/exp3-latest.json` | 2026-11-18T18:17:17Z | `llm_real_ollama` etapa 2 |
| EXP3-EXTRACT | Extracto sanitizado | Daniel | **DISPONIBLE** | `evidencias/exp3-daniel/FINAL-REPORT.extract.json` | 2026-11-18 | Allowlist |
| EXP2-BRANCH | Exp. 2 Hotel OCI lab | Samuel | **DISPONIBLE (público)** | https://github.com/sgiraldor/hotel-fastify/tree/feat/defensa-profundidad-oci @ `742c575a` | Consulta 2026-11-18 | |
| EXP2-R0 | Exp. 2 R0 summary | Samuel | **DISPONIBLE** | `evidencias/exp2-samuel/R0-SUMMARY.json` | 2026-11-18T05:13:39Z | |
| EXP2-R1 | Exp. 2 R1 summary | Samuel | **DISPONIBLE** | `evidencias/exp2-samuel/R1-SUMMARY.json` | 2026-11-18T05:18:05Z | VALID_R1; mttd_ms=20 |
| EXP2-AI-GRP | Análisis grupal Exp2 | Daniel | **DISPONIBLE** | `evidencias/ai-runs/exp2-latest.json` (+ historial stamped) | 2026-11-18T18:22:39Z | Etapa 3: JSON parseable; format warning `claims`; sin NP OKE |
| EXP1-JAR | Exp. 1 Sports | Jarrison | **PENDIENTE** | *URL no inventada* | — | |
| EXP1-HONEY | Tendencia honeytoken | Jarrison | **PENDIENTE** | `tendencias/honeytoken/FICHA_TECNICA.md` | Consulta 2026-11-18 | Checklist de evidencia requerida |
| EXP4-DATA | Exp. 4 resiliencia | Samuel | **EN CURSO** | — | — | |
| T2-LAB | Remediación human-approval | Daniel | **DISPONIBLE (lab local)** | `evidencias/tendencia-2-human-approval/` | 2026-11-18 | No cloud |

## Dependencias abiertas

1. **Jarrison:** URL/paquete Exp.1 + honeytoken con alerta real.  
2. **Samuel:** Exp.4 RPO/RTO/ransomware.  
3. Confirmación reutilización honeytoken como tendencia grupal.
