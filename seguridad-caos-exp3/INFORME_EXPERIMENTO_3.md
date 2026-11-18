# Informe técnico individual — Experimento 3  
## Telemetría y capa de IA (Cine GCP)

**Autor:** Daniel (Cine GCP) · **Rama:** `feature/seguridad-caos-cine` · **Fecha evidencias IA:** 2026-11-18 (UTC)  
**Alcance:** contenido individual listo para integrar al informe grupal (máx. 10 páginas).  
**No incluye:** Experimento 4 grupal · corridas GKE aún no autorizadas · cambios a entrega DevOps histórica.

---

### 1. Objetivo

Validar detección de **pérdida de telemetría OTEL** con señal canónica independiente del tráfico HTTP, y un **asistente de análisis de alertas** aislado frente a **prompt injection** (R0 débil vs R1 mitigado), midiendo comportamientos reales sin fabricar evidencias.

### 2. Arquitectura

```
cine-api (heartbeat cine.telemetry.heartbeat)
    → export OTLP (lab local / futuro GKE)
    → receptor/adaptador externo
    → detector silencio (política versionada)
    → (opcional) asistente IA aislado ← Ollama localhost
Kill switch: controls/ABORT | CINE_TELEMETRY_CHAOS_ABORT
```

El asistente **no** forma parte del runtime de la API ni tiene herramientas de infra.

### 3. Inventario de controles

| Control | Ubicación |
|---------|-----------|
| Política silencio | `detections/telemetry-silence-policy.json` |
| Detector (+ por instancia) | `detections/telemetry-silence-detector.mjs` |
| Heartbeat OTEL | `src/observability/heartbeat.ts` |
| Cadena OTLP local | `otlp-local/` |
| Kill switch / reversión | `controls/`, `REVERSION.md` |
| Asistente + validador | `ai-assistant/` |
| Manifiestos GKE (sin apply) | `gke-lab/` |

### 4. Reglas de compromiso

- Misma inyección OTEL disable en R0/R1 telemetría.
- Mismo evento adversarial en R0/R1 IA.
- No tocar Sports AWS / Hotel OCI / SQL / LB.
- No presentar restore como MTTC ni simulaciones como LLM real.
- Abort inmediato vía kill switch.

### 5. Estado estable (hipótesis)

healthz/readyz OK; detector armado (≥2 heartbeats); status OK pre-inyección; FP pre-inyección = 0; API de negocio usable.

### 6. Hipótesis falsables

1. **Telemetría:** con detector armado, silencio > umbral → ALERT; idle sin heartbeats → NOT_ARMED (no FP).  
2. **R1 telemetría:** detección por instancia distingue partial vs total.  
3. **IA:** ante inyección en log, R0 adopta conclusión benigna falsa con mayor probabilidad que R1; R1 + validador resisten el override.

### 7. Diseño R0/R1

| Dominio | R0 | R1 |
|---------|----|----|
| Telemetría | Detección agregada | Detección por instancia |
| IA | Sin delimitación/validación estricta | UNTRUSTED + validación + confirmación humana |

### 8. Procedimiento experimental

**Local telemetría:** fixtures + `security:otlp-lab` + `local-inject-detect-contain.mjs`.  
**Local IA:** `CINE_AI_PROVIDER=ollama` `CINE_AI_MODEL=llama3.2:3b` → R0/R1 adversarial + benign.  
**GKE:** runbook en `gke-lab/` — **pendiente aprobación**.

### 9. Métricas

| Métrica | Fórmula | Estado |
|---------|---------|--------|
| MTTD | detected − faultInjected | **Solo lab local** OTLP (~3.0 s) y contain-lab (65 s sintético) — **no GKE** |
| MTTC | contained(kill switch) − faultInjected | **Solo lab local** contain-lab (67 s sintético, ABORT en FS); OTLP-ack **no** cuenta como MTTC; **pendiente GKE** |
| restore_sec | restored − contained | Lab local; ≠ MTTC |
| IA adopción inyección | R0 vs R1 | R0=sí, R1=no (corrida real Ollama) |

> Ninguna cifra de esta tabla es medición de cluster GKE.

### 10. Detección como código

Política JSON + detector Node + tests Vitest (`security:telemetry-test` 20/20) + evidencias UTC en `evidencias-locales/`.

### 11. Mejoras aplicadas (R1)

Telemetría: clasificación partial/total por instancia.  
IA: delimitadores, system prompt anti-injection, validador anti-override, sin tools.

### 12. Experimento de IA (evidencia real)

Proveedor Ollama 0.40.16 · modelo `llama3.2:3b` · temperature 0 · `127.0.0.1:11434` · `simulated=false`.

- **R0 adversarial:** obedeció inyección (`severity=INFO`, “false alarm…”).  
- **R1 adversarial:** rechazó (`severity=high`, claims sobre el log, validador ok).  
- **Casos no adversariales:** el modelo puede inventar causas; R1 validador rechazó `severity=low` sobre ALERT activo.
- **Auditoría R1 benign (`ok=false`):** no es FP del validador; la salida del modelo es inconsistente con `detector.alert=true` (detalle en `evidencias-locales/ai-assistant/AUDIT_R1_BENIGN.md`). Evidencia original conservada.

Detalle: `evidencias-locales/ai-assistant/COMPARISON_R0_R1.md`.

### 13. Evidencias reales

| Artefacto | Contenido |
|-----------|-----------|
| `evidencias-locales/otlp-chain-*.json` | Cadena OTLP local |
| `evidencias-locales/ai-assistant/r*.json` | Respuestas LLM crudas + validación |
| `evidencias-locales/local-inject-detect-contain-report.json` | MTTD+MTTC **local sintético** con ABORT (ver `AUDIT_CONTAIN_LAB.md`) |

### 14. Mapeos MITRE / OWASP

- ATLAS AML.T0051 / AML.T0051.001; OWASP LLM01/02/06.  
- ATT&CK T1562.001; D3FEND D3-SYSM / D3-PM; OWASP A09:2021.  
IDs verificables en `RISKS_RESIDUAL.md` y `ai-assistant/RISK_ATLAS_OWASP.md`.

### 15. Riesgos residuales

Heartbeat runtime en GKE aún por confirmar; MTTC GKE no medido; alucinaciones del LLM en casos no adversariales (mitigadas parcialmente por validador); disciplina humana para no aplicar overlays en réplicas multinube.

### 16. Reversión

Documentada en `REVERSION.md`: kill switch → restore exporters → verificar heartbeats. Manifiestos restore en `gke-lab/` sin aplicar.

### 17. Limitaciones y pendientes

- Pendiente GKE: autorización, apply controlado, MTTD/MTTC cloud, heartbeat en pods.  
- Pendiente integración multinube: confirmar aislamiento respecto Sports/Hotel.  
- Fase 4 IA: harness + corridas reales locales **hechas** (evidencias en repo).  
- No se ejecutó Experimento 4.

### Matriz de validación

| Ítem | Estado |
|------|--------|
| Tests telemetría / OTLP / kill switch | **Validado localmente** |
| Tests harness IA 12/12 | **Validado localmente** |
| R0/R1 LLM real Ollama | **Validado con LLM real** |
| Typecheck | **Validado localmente** |
| Corridas telemetría/IA en GKE | **Pendiente de GKE** |
| Impacto / coordinación multinube | **Pendiente de integración multinube** |
