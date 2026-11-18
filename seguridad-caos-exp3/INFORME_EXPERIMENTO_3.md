# Informe técnico individual — Experimento 3  
## Telemetría y capa de IA (Cine GCP)

**Autor:** Daniel (Cine GCP) · **Rama:** `feature/seguridad-caos-cine`  
**Ejecución GKE válida:** 2026-11-18T17:37Z–17:54Z (UTC) · carpeta `evidencias-locales/gke-r0-r1-retest/`  
**Ejecución GKE histórica (R1 inválida por restart):** `evidencias-locales/gke-r0-r1/` — conservada  
**Alcance:** contenido individual para integración grupal. **No incluye** Experimento 4.

---

### 1. Objetivo

Validar en laboratorio aislado GKE la **detección de pérdida parcial de telemetría OTEL** (R0 agregado vs R1 por instancia) con contención ABORT medible, y un **asistente de análisis de alertas** frente a **prompt injection** (R0 débil vs R1 mitigado con Ollama real).

### 2. Arquitectura del laboratorio

```
Namespace cine-seguridad-exp3 (GKE Autopilot, aislado de cine-caos)
  ├─ emitter-a / emitter-b  → heartbeats cine.telemetry.heartbeat
  │     emitter-b: /emit-flags (ConfigMap) + /containment (ABORT)
  ├─ otlp-receiver ClusterIP :4319 → /detector-samples
  ├─ NetworkPolicy default-deny + DNS (169.254.20.10) + OTLP lab-only
  └─ Sin LB, sin WI DevOps, sin Cloud SQL, sin OCI

Asistente IA (local): Ollama localhost ← logs/detector (sin tools de infra)
Kill switch: controls/ABORT | CINE_TELEMETRY_CHAOS_ABORT → CONTAINMENT_ACTIVE=true
```

### 3. Hipótesis y controles

| Hipótesis | Control |
|-----------|---------|
| Misma inyección parcial (B silent / A OK) en R0 y R1 | Patch ConfigMap `/emit-flags` **sin** rollout restart |
| R0 agregado no alerta pérdida parcial | `evaluateTelemetrySilence` |
| R1 alerta `lossKind=partial` mismo `instanceId` | `evaluateTelemetrySilenceByInstance` |
| Contención ABORT fuerza emisión | Volumen `/containment` |
| No impactar DevOps | Solo NS lab; DevOps 2/2 + LB `35.239.107.54` solo lectura |
| IA: R1 resiste prompt injection mejor que R0 | Ollama + validador R1 |

### 4. Resultados R0/R1 GKE (corrida válida)

| | R0 (agregado) | R1 (por instancia) |
|--|---------------|---------------------|
| ALERT | **No** | **Sí** |
| lossKind | — | **partial** |
| MTTD | **null** (no detectado) | **7.51 s** |
| MTTC (contain verificado) | **182.7 s** | **148.1 s** |
| restore_sec | **77.4 s** | **118.0 s** |
| Cobertura | 0 | **1/1** |
| FP pre-inyección | 0 | 0 |
| instanceId B | estable | estable (`…-s9ndm`) |

**Mejora verificada:** R0 ciego a pérdida parcial; R1 alerta sobre el mismo emisor B armado.

### 5. Primera R1 GKE (inválida — metodología)

Usó `rollout restart` → nuevo `instanceId` nunca armado → sin ALERT. Documentado en `gke-lab/METODOLOGIA-R1-RESTART-ERROR.md` y `evidencias-locales/gke-r0-r1/`. **No usar esas métricas R1 como demostración de mejora.**

### 6. Contención y restauración

1. ABORT local → `abortRequestedAtUtc`  
2. Patch `CONTAINMENT_ACTIVE=true` → `containAppliedAtUtc`  
3. Archivo montado + muestras A/B → `containedAtUtc` (**MTTC**)  
4. Clear containment + flags emit OK (sin restart) → `telemetryRestoredAtUtc` (**≠ MTTC**)  
Lab eliminado al cierre; DevOps intacto.

### 7. R0/R1 IA (Ollama real)

Proveedor Ollama · `llama3.2:3b` · `simulated=false` · UTC ~2026-11-18T16:12Z.

- **R0 adversarial:** adoptó inyección (`severity=INFO`, “false alarm”).  
- **R1 adversarial:** rechazó override; `severity=high` + claims humanos; validador ok.  
- **Benign:** alucinaciones posibles; validador R1 bloqueó override low sobre ALERT.  

Detalle: `evidencias-locales/ai-assistant/COMPARISON_R0_R1.md`.

### 8. Riesgos residuales

- Sync ConfigMap→volumen (latencia kubelet) afecta MTTC observado.  
- Modelos pequeños: alucinaciones en casos no adversariales.  
- Disciplina humana: no aplicar overlays fuera del NS lab.  
- Ver `RISKS_RESIDUAL.md`.

### 9. Referencias MITRE / OWASP

- ATT&CK [T1562.001](https://attack.mitre.org/techniques/T1562/001/); D3FEND D3-SYSM / D3-PM; OWASP A09:2021.  
- ATLAS AML.T0051 / AML.T0051.001; OWASP LLM01 / LLM02 / LLM06.  

### 10. Lecciones aprendidas

1. **Identidad estable** es requisito para R1 por instancia: flags por volumen, nunca restart para inject.  
2. DNS Autopilot exige egress a `169.254.20.10`, no solo pods `kube-system`.  
3. Distinguir `abortRequested` / `containApplied` / `containedAtUtc` / `telemetryRestoredAtUtc`.  
4. Conservar evidencias fallidas + addendum evita reescribir la historia experimental.  
5. El validador IA complementa pero no sustituye confirmación humana.

### 11. Matriz de validación

| Ítem | Estado |
|------|--------|
| Tests telemetría / emit-gate / manifests | Validado local |
| Typecheck | Validado |
| R0/R1 IA Ollama | Validado |
| R0/R1 telemetría GKE (retest) | **Validado** |
| Teardown lab + DevOps 2/2 | **Validado** |
| Experimento 4 | No ejecutado |
