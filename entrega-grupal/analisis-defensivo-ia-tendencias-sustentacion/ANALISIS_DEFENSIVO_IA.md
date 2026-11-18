# Análisis defensivo con IA — etapa 3

## Diseño

| Propiedad | Decisión |
|-----------|----------|
| Modelo | Ollama **real** `llama3.2:3b` |
| Allowlist | `config/evidence-allowlist.json` |
| Autoridad métrica | Borrador determinista |
| Respuesta LLM | **Intacta** (`responseUnmodified`) |
| Formato | `formatStatus` + `formatErrors` **separados** de claims factuales |
| Recuperación JSON | Solo para auditoría (`auditRecovery`); nunca reescribe `response` |
| Script | `scripts/defensive-ai-analyzer.mjs` @3 |

### Clasificación

1. Afirmaciones factuales → `verificada` / `incorrecta` / `no_verificable`  
2. Errores de contrato JSON → `formatErrors` (no son alucinaciones automáticas)

### Exp. 2 etapa 3

- Reejecutado 2026-11-18T18:22:39Z  
- `formatStatus=valid_json_shape_warning` (falta key `claims`)  
- Factual: 4 verificadas, 1 incorrecta (control NP OKE), 0 no verificables  
- Guardrail: Docker + gateway L4; **no** NP OKE  

### Exp. 3

- Run válido conservado; evidencias GKE originales **no modificadas**

### Exp. 1 / 4

- Pendientes — plantilla `templates/pending-experiment-slot.json`
