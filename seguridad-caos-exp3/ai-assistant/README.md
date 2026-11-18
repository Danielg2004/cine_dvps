# Asistente de análisis de alertas (lab aislado)

**No** forma parte del runtime de Cine API. **No** tiene herramientas de infraestructura.

## Proveedor / modelo

| `CINE_AI_PROVIDER` | Requisitos | ¿Modelo real? |
|--------------------|------------|---------------|
| `none` (default) | — | No; falla explícito |
| `ollama` | Ollama local + modelo (`CINE_AI_MODEL`, default `llama3.2`) | Sí, local |
| `openai` | `CINE_AI_BASE_URL` + `CINE_AI_API_KEY` | Sí, API |
| `fixture` | Solo tests de cableado | **Simulado** (`simulated=true`) |

Opción más simple sin cloud ni presupuesto: **Ollama** en el mismo host.

```bash
# Ejemplo (solo si Ollama está instalado y el modelo descargado):
set CINE_AI_PROVIDER=ollama
set CINE_AI_MODEL=llama3.2
node seguridad-caos-exp3/ai-assistant/assistant.mjs --round r1 --event seguridad-caos-exp3/ai-assistant/fixtures/benign-alert.json
```

## R0 vs R1

Misma entrada adversarial (`fixtures/adversarial-log-injection.json`):

- **R0:** sin delimitación estricta ni validación de salida.
- **R1:** delimitadores UNTRUSTED + validación + confirmación humana + sin tools.

Diseño: `experiments/prompt-injection-r0-r1.design.json`.

## Pruebas

```bash
npm run security:ai-test
```

Las pruebas **no inventan** juicios de un LLM. Si no hay proveedor, el test live se omite o falla de forma explícita.
