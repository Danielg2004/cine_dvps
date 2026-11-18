# Análisis defensivo con IA · Tendencias · Guía de sustentación

**Responsable:** Daniel (Cine GCP)  
**Consumidor:** Jarrison (informe grupal ≤10 páginas)  
**Rama:** `feature/seguridad-caos-cine` · repo `cine_dvps`  
**Estado:** Exp1 AWS + T1 honeytoken cerrados en lab · Exp4 pendiente · **sin commit/push** hasta autorización

## Estructura

```
analisis-defensivo-ia-tendencias-sustentacion/
├── README.md / RESUMEN_PARA_JARRISON.md
├── MATRIZ_FUENTES.md / ANALISIS_DEFENSIVO_IA.md / AUDITORIA_CONCLUSIONES_IA.md
├── TENDENCIAS_SEGURIDAD.md / GUIA_SUSTENTACION.md / PLAN_IMPLEMENTACION.md
├── config/evidence-allowlist.json
├── scripts/ (analyzer, prepare-exp1-aws, human-approval)
├── tendencias/honeytoken/          # T1 evidenciada (lab AWS)
├── tendencias/human-approval-remediation/  # T2 local
└── evidencias/
    ├── exp1-aws-jarrison/          # sanitizado desde commit 1cad076…
    ├── exp2-samuel/ / exp3-daniel/
    ├── ai-runs/ / tendencia-2-human-approval/
```

## Principios

1. LLM ≠ fuente de verdad; ver `AUDITORIA_CONCLUSIONES_IA.md`.  
2. Exp1: solo extractos sanitizados en prompts.  
3. T1 honeytoken: detección local evidenciada; **no** SIEM.  
4. T2: lab local; no cloud.  
5. Exp4: pendiente Samuel.

## Comandos

```bash
node .../scripts/prepare-exp1-aws-evidence.mjs
node .../scripts/defensive-ai-analyzer.mjs --experiment exp1 --ollama
npx vitest run .../tests/human-approval-remediation.test.ts
```
