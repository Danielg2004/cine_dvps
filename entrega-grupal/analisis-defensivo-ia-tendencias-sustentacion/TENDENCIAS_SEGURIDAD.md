# Tendencias de ciberseguridad — etapa 3

**Consulta de fuentes UTC:** 2026-11-18  
**T2:** instrumentada y validada **localmente** (no remediación cloud).  
**T1:** pendiente de evidencias originales de Jarrison.

## Tendencia 1 — Honeytoken con detección y alerta real

| Aspecto | Estado |
|---------|--------|
| Ficha técnica | `tendencias/honeytoken/FICHA_TECNICA.md` |
| Código/evidencia inventariada | **No localizado** |
| Reutilizable sin repetir experimento | **Pendiente** de paquete Jarrison |
| Relación rúbrica | Detección temprana / engaño defensivo verificable |
| Diseño / implementación / validación | Diseño conceptual OK · impl/validación grupal **PENDIENTE** |

No se inventa implementación ni resultados.

---

## Tendencia 2 — Remediación automatizada con aprobación humana

| Aspecto | Estado |
|---------|--------|
| Diseño | **Hecho** — `tendencias/human-approval-remediation/` |
| Implementación lab local | **Instrumentada** — `scripts/human-approval-remediation.mjs` |
| Validación | **Validada localmente** (Vitest 6/6 + demos en `evidencias/tendencia-2-human-approval/`) |
| Validación cloud | **No** — no se presenta como remediación ejecutada en GCP/AWS/OCI (`cloudTouched=false`) |
| Relación rúbrica | Automatización defensiva + human-in-the-loop |
| Reutiliza | Alerta verificable estilo Exp.3 (`R1.alert`) + flag de contención local |

### Flujo demostrado (reproducible)

1. **Detección** — alerta con `verified=true` y `evidenceRef` a extracto Exp3.  
2. **Propuesta** — `PROPOSAL_PENDING.json` (`executed=false`).  
3. **Decisión humana** — `approve` / `reject` / `absent` + `approverId`.  
4. **Acción** — solo tras `approve` de aprobador allowlisted: escribe flag local.  
5. **Verificación** — `verifiedAfter.flagExists`.  
6. **Reversión** — elimina flag (`REVERT_LATEST.json` / demo).  

### Pruebas automatizadas (Vitest)

6/6 pass: unverified, reject, approve+verify, unauthorized approver, absent auth, demo approve→revert.

### Demostraciones CLI conservadas

`evidencias/tendencia-2-human-approval/` (`latest.json`, `DEMO_LATEST.json`, runs).

### Limitaciones (obligatorio en sustentación)

- **Lab local ≠ remediación real de GCP/AWS/OCI.**  
- No ejecuta `kubectl`/`terraform`/CLIs cloud.  
- Política `cloudMutationAllowed=false`.  
- Demuestra el **control de aprobación humana**, no un SOAR productivo.

### Fuentes conceptuales verificables

- NIST SP 800-207 (decisión continua / políticas)  
- Contención post-detección (ATT&CK defense impairment ↔ respuesta)  
- Principio human-in-the-loop antes de cambio de estado defensivo  

Fecha de consulta conceptual: 2026-11-18.
