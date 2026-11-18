# Análisis defensivo con IA · Tendencias · Guía de sustentación

**Responsable:** Daniel (Cine GCP)  
**Consumidor:** Jarrison (informe grupal ≤10 páginas)  
**Rama origen:** `feature/seguridad-caos-cine` · repo `cine_dvps`  
**Estado etapa 3:** auditoría formato≠alucinación · Exp2 reejecutado · paquete listo para versionar  
**Sin commit/push** hasta autorización explícita

Paquete **independiente** para integrar al repositorio grupal.

## Estructura

```
analisis-defensivo-ia-tendencias-sustentacion/
├── README.md
├── RESUMEN_PARA_JARRISON.md          # ≤2 páginas para el informe grupal
├── MATRIZ_FUENTES.md
├── ANALISIS_DEFENSIVO_IA.md
├── AUDITORIA_CONCLUSIONES_IA.md
├── TENDENCIAS_SEGURIDAD.md
├── GUIA_SUSTENTACION.md
├── PLAN_IMPLEMENTACION.md
├── config/evidence-allowlist.json
├── templates/pending-experiment-slot.json
├── scripts/
│   ├── defensive-ai-analyzer.mjs
│   └── human-approval-remediation.mjs
├── tendencias/
│   ├── honeytoken/FICHA_TECNICA.md   # T1 pendiente
│   └── human-approval-remediation/   # T2 lab local
├── tests/human-approval-remediation.test.ts
└── evidencias/
    ├── ai-runs/                      # prompts, respuestas Ollama, audits
    ├── exp3-daniel/
    ├── exp2-samuel/
    └── tendencia-2-human-approval/
```

## Principios

1. El **LLM no es fuente de verdad**; ver `AUDITORIA_CONCLUSIONES_IA.md`.  
2. No se inventan Exp. 1 ni Exp. 4.  
3. T1 honeytoken: **pendiente** Jarrison.  
4. T2: lab **local** (`cloudTouched=false`); no es remediación GCP/AWS/OCI.

## Comandos locales

```bash
# Análisis defensivo (Ollama real)
node entrega-grupal/analisis-defensivo-ia-tendencias-sustentacion/scripts/defensive-ai-analyzer.mjs --experiment exp3 --ollama
node entrega-grupal/analisis-defensivo-ia-tendencias-sustentacion/scripts/defensive-ai-analyzer.mjs --experiment exp2 --ollama

# Tendencia 2
node .../scripts/human-approval-remediation.mjs --demo --decision approve
npx vitest run entrega-grupal/analisis-defensivo-ia-tendencias-sustentacion/tests/human-approval-remediation.test.ts
```

## Integración (Jarrison)

1. Copiar esta carpeta al repo grupal.  
2. Leer primero `RESUMEN_PARA_JARRISON.md`.  
3. Completar huecos Exp1/Exp4/honeytoken cuando existan fuentes oficiales.

### Autocontención

- **Exp2 / T2 / runs IA / docs:** autocontenidos en esta carpeta.  
- **Exp3:** extracto sanitizado local (`evidencias/exp3-daniel/`) basta para el informe; la allowlist también referencia `../../seguridad-caos-exp3/...` (accesible dentro de `cine_dvps`). Si se copia el paquete solo, conservar el extracto y el `RESUMEN_PARA_JARRISON.md`.
