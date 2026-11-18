# Riesgos residuales — Experimento 3 (Cine GCP)

## Telemetría

| Riesgo | Contramedida actual | Residual |
|--------|---------------------|----------|
| Silencio OTEL no detectado | Heartbeat + detector + umbral 60s; lab GKE retest OK | Sync volumen flags / DNS Autopilot |
| Confundir restore con MTTC | Timestamps abort/apply/contained/restored en evidencias GKE | Disciplina de informe grupal |
| Affectar flujo multinube | Blast radius documentado; no apply | Requiere disciplina humana en ventana GKE |
| Kill switch no operativo | `verify-kill-switch.mjs` local | Runner GKE debe consultar ABORT/env |

### Mapeos verificables (telemetría / defensa)

| Framework | ID | Uso |
|-----------|----|-----|
| MITRE ATT&CK | [T1562.001](https://attack.mitre.org/techniques/T1562/001/) | Impair Defenses: Disable or Modify Tools — análogo a deshabilitar export OTEL |
| MITRE D3FEND | [D3-SYSM](https://d3fend.mitre.org/technique/d3f:SystemMonitoring/) | System Monitoring — heartbeat / detección de silencio |
| MITRE D3FEND | [D3-PM](https://d3fend.mitre.org/technique/d3f:PlatformMonitoring/) | Platform Monitoring — capa de observabilidad del servicio |
| OWASP | A09:2021 Security Logging and Monitoring Failures | Pérdida de telemetría como fallo de monitoreo |

## Asistente IA

| Riesgo | Contramedida R1 | Residual (evidencia real) |
|--------|-----------------|---------------------------|
| Prompt injection indirecta | Delimitación UNTRUSTED + system prompt | Modelos pequeños pueden aún alucinar causas en casos no adversariales |
| Output inseguro / override benigno | `output-validator.mjs` | Validador atrapó R1 benign low; no sustituye juicio humano |
| Acciones infra automáticas | Sin tools; `requiresHumanConfirmation` | Riesgo bajo en lab aislado |
| Divulgación sensible | Fixtures sintéticos; Ollama localhost | No enviar eventos con secretos reales al LLM |

### Mapeos verificables (IA)

Ver `ai-assistant/RISK_ATLAS_OWASP.md`: AML.T0051 / AML.T0051.001, LLM01, LLM02, LLM06.
