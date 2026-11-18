# Análisis defensivo con IA — con Exp.1 AWS

## Diseño

| Propiedad | Decisión |
|-----------|----------|
| Modelo | Ollama real `llama3.2:3b` |
| Allowlist | `config/evidence-allowlist.json` @3 |
| Exp1 | Extractos sanitizados desde commit grupal `1cad076…` |
| Formato | `formatErrors` ≠ alucinaciones |
| Script | `scripts/defensive-ai-analyzer.mjs` @3 |

## Exp. 1 (Jarrison / AWS lab) — DISPONIBLE

| Campo | Contenido anclado a evidencia |
|-------|-------------------------------|
| Incidente | Reuse de machine-token + ejercicio de honeytoken en lab ClusterIP+túnel |
| R0 | `r0_weak`: reuseAllowed=8, detections=0; honeytoken 403/`identity.honeytoken_use` |
| R1 | `r1_strict`: reuseDenied=8, detections=8, mttdMs=398 (reuse); honeytoken 403/`identity.honeytoken_use` |
| Honeytoken | Evento **A** distinto de reuse **B**; sin grant |
| Alertamiento | Application securityEvent — **not CloudWatch/SIEM** |
| Riesgos | Sin ts/traceId honeytoken en events[]; lab≠prod |

Run: `evidencias/ai-runs/exp1-latest.json` (`llm_real_ollama`, 2026-11-18T19:03:34Z).

## Exp. 2 / 3

Sin cambio de veredicto (ver `AUDITORIA_CONCLUSIONES_IA.md`).

## Exp. 4

PENDIENTE Samuel.
