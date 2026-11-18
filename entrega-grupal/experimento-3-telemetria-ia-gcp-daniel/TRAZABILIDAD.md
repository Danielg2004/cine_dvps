# Trazabilidad — Exp. 3

## Código y políticas

| Pieza | Ruta relativa |
|-------|----------------|
| Detector | `../../seguridad-caos-exp3/detections/telemetry-silence-detector.mjs` |
| Política lab | `../../seguridad-caos-exp3/detections/telemetry-silence-policy.exp3-lab.json` |
| Emit gate | `../../seguridad-caos-exp3/lab/emit-gate.mjs` |
| Runner local | `../../seguridad-caos-exp3/scripts/exp3-lab-runner.mjs` |
| Runner GKE | `../../seguridad-caos-exp3/scripts/exp3-gke-r0-r1-runner.mjs` |
| Contención | `../../seguridad-caos-exp3/scripts/exp3-containment.mjs` |
| Manifiestos | `../../seguridad-caos-exp3/gke-lab/base/` + `overlays/` |
| Asistente IA | `../../seguridad-caos-exp3/ai-assistant/` |
| Informe | `../../seguridad-caos-exp3/INFORME_EXPERIMENTO_3.md` |

## Evidencias (sanitizadas / sintéticas)

| Carpeta | Contenido |
|---------|-----------|
| `../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1-retest/` | R0/R1 GKE válidos, samples OTLP, FINAL-REPORT |
| `../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1/` | Primera corrida + addendum R1 inválida |
| `../../seguridad-caos-exp3/evidencias-locales/dns-netpol-fix/` | Diagnóstico/corrección DNS |
| `../../seguridad-caos-exp3/evidencias-locales/ai-assistant/` | R0/R1 Ollama |
| `../../seguridad-caos-exp3/evidencias-locales/gke-lab-initial/` | Inventario lab / aislamiento |

No hay secretos DevOps, keys cloud ni dumps de Cloud SQL en estas rutas.

## Tests

- `../../tests/seguridad-caos-exp3-r0-r1-partial.test.ts`
- `../../tests/seguridad-caos-exp3-emit-gate-stable-id.test.ts`
- `npm run security:telemetry-test` / `security:ai-test` / `security:exp3-validate-manifests`
