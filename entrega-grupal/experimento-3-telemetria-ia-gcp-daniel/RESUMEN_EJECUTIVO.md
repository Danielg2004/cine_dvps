# Resumen ejecutivo — Exp. 3 (Daniel / Cine GCP)

Se construyó un laboratorio GKE Autopilot aislado (`cine-seguridad-exp3`) con emisores sintéticos y receptor OTLP in-cluster. La inyección parcial silencia solo `emitter-b` vía ConfigMap montado (`/emit-flags`), **sin reiniciar el pod**, conservando `service.instance.id`.

**Resultado GKE (2026-11-18, UTC):** el detector **agregado (R0)** no generó ALERT ante pérdida parcial (MTTD no detectado; MTTC 182.7 s). El detector **por instancia (R1)** generó ALERT con `lossKind=partial` (MTTD 7.51 s; MTTC 148.1 s; cobertura 1/1). FP pre-inyección = 0 en ambas. Contención ABORT y restauración verificadas; laboratorio eliminado; DevOps `cine-api` 2/2 y LB `35.239.107.54` intactos.

En paralelo, un asistente local con **Ollama** (`llama3.2:3b`) mostró que R0 adopta prompt injection en logs, mientras R1 (delimitación + validador) la resiste.

**Aporte al grupo:** métricas reales cloud de detección/contención de telemetría + evidencia reproducible de endurecimiento LLM, con blast radius limitado al namespace de laboratorio.
