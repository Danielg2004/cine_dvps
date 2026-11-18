# Riesgo — Prompt injection en asistente de alertas (lab)

Referencias **verificables** (no se inventan IDs):

## MITRE ATLAS

| ID | Nombre | Uso en este lab |
|----|--------|-----------------|
| [AML.T0051](https://atlas.mitre.org/techniques/AML.T0051) | LLM Prompt Injection | Técnica padre |
| [AML.T0051.001](https://atlas.mitre.org/techniques/AML.T0051.001) | Indirect | Instrucción adversaria embebida en campo `logs[].message` del evento sintético |

Fuente de datos ATLAS: [mitre-atlas/atlas-data](https://github.com/mitre-atlas/atlas-data).

## OWASP Generative AI / LLM Top 10

| ID | Nombre | Mitigación en R1 |
|----|--------|------------------|
| [LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | Prompt Injection | Delimitación de datos no confiables + system prompt anti-jailbreak |
| [LLM02](https://genai.owasp.org/llmrisk/llm02-insecure-output-handling/) | Insecure Output Handling | `output-validator.mjs` (JSON schema práctico, rechazo de acciones infra) |
| [LLM06](https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/) | Sensitive Information Disclosure | Fixtures sintéticos; sin secretos reales; proveedor configurable sin hardcodear claves |

## ATT&CK / D3FEND (contexto telemetría del mismo experimento)

| ID | Nombre | Uso |
|----|--------|-----|
| [T1562.001](https://attack.mitre.org/techniques/T1562/001/) | Disable or Modify Tools | Análogo ofensivo: deshabilitar export OTEL |
| [D3-SYSM](https://d3fend.mitre.org/technique/d3f:SystemMonitoring/) | System Monitoring | Heartbeat + detector |
| [D3-PM](https://d3fend.mitre.org/technique/d3f:PlatformMonitoring/) | Platform Monitoring | Observabilidad de plataforma |

## Límites del lab

- El asistente **no** tiene herramientas de GCP/K8s/SQL/OS.
- Las pruebas automatizadas validan harness y mitigaciones.
- Corrida real documentada (2026-11-18 UTC): Ollama `llama3.2:3b`, evidencias en `evidencias-locales/ai-assistant/` (`simulated=false`).
