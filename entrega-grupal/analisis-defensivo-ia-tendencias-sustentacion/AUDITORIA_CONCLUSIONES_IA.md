# Auditoría humana de conclusiones IA — etapa 3

**Regla:** el LLM no cierra el informe. Esta tabla es la autoridad.  
**Modelo:** Ollama `llama3.2:3b` (`simulated=false`, `responseUnmodified=true`)  
**Leyenda:**

| Categoría | Significado |
|-----------|-------------|
| **Verificada** | Afirmación factual coherente con evidencia allowlisted |
| **Incorrecta** | Afirmación factual contradicha o cifra inventada |
| **No verificable** | Afirmación factual sin ancla suficiente |
| **Error de formato** | Contrato/sintaxis JSON — **no** se cuenta como alucinación |

---

## Exp. 2 (OCI / Samuel) — reejecución etapa 3

| Campo | Valor |
|-------|-------|
| Run stamp | `evidencias/ai-runs/exp2-1795026166348.json` |
| UTC | 2026-11-18T18:22:39Z → 18:22:46Z |
| `formatStatus` | `valid_json_shape_warning` |
| Errores de formato | **1** — `missing_key:claims` (shape; JSON parseable) |
| Historial previo | Conservado (`exp2-*.json` anteriores + `exp2-previous-latest-*`) |

### Conteos factuales (etapa 3)

| Clasificación | Cantidad |
|---------------|----------|
| Verificada | **4** |
| Incorrecta | **1** (control negativo deliberado OKE NP) |
| No verificable | **0** |
| Error de formato (aparte) | **1** |

### Afirmaciones

| Afirmación | Origen | Clasificación | Evidencia / nota |
|------------|--------|---------------|------------------|
| Lab Docker (no OKE prod); R0 permisivo; R1 bloquea+alerta | llm | **verificada** | Coherente con R0/R1-SUMMARY + SOURCE |
| Causa: L4 permisivo vs L4+unauthorized_deny | llm | **verificada** | Summaries / borrador |
| R0 mttd/mttc not_observed | deterministic | **verificada** | `R0-SUMMARY.json` |
| R1 VALID_R1; g1_block+g2_alert; mttd_ms=20 | deterministic | **verificada** | `R1-SUMMARY.json` |
| Equivale a NetworkPolicy OKE producción | deterministic (control negativo) | **incorrecta** | Exp2 = Docker + gateway L4; **no** atribuir NP OKE a Samuel |
| Falta key `claims` en JSON LLM | formato | **error de formato** | No es alucinación factual |

### Corrección respecto a etapa 2

En etapa 2, un JSON truncado se clasificó como `incorrecta` factual. **Eso fue un error de proceso.** En etapa 3 los fallos de contrato JSON van en `formatErrors` / `formatStatus` y **no** inflan el conteo de alucinaciones.

### Attribution check (obligatorio)

El análisis **no** atribuye NetworkPolicy de OKE a Samuel. El LLM latest dice explícitamente lab Docker / no OKE prod. El único ítem “OKE NP equivalente” es un **control negativo** marcado incorrecto a propósito.

---

## Exp. 3 (Cine / Daniel) — run etapa 2 conservado

| Campo | Valor |
|-------|-------|
| Run latest referenciado | `evidencias/ai-runs/exp3-latest.json` (stage 2, JSON válido) |
| Evidencia fuente | `FINAL-REPORT.extract.json` + allowlist GKE retest |
| Exp3 original | **No modificado** |

### Conteos factuales

| Clasificación | Cantidad |
|---------------|----------|
| Verificada | **7** |
| Incorrecta | **0** (en run) |
| No verificable | **0** |
| Error de formato | **0** (run latest válido) |

Anti-patrones humanos (si alguien los afirma): R1 con restart como mejora = **incorrecta**; DevOps impactado = **incorrecta**.

---

## Exp. 1 / Exp. 4

| Exp | Clasificación | Nota |
|-----|---------------|------|
| 1 | **no_verificable** | Pendiente Jarrison |
| 4 | **no_verificable** | Samuel en curso |

---

## Totales factuales publicables (etapa 3)

| | Verificadas | Incorrectas factuales | No verificables | Errores formato |
|--|-------------|----------------------|-----------------|-----------------|
| Exp2 | 4 | 1 | 0 | 1 |
| Exp3 | 7 | 0 | 0 | 0 |
| Exp1+4 | 0 | 0 | 2 | 0 |
| **Total** | **11** | **1** | **2** | **1** |
