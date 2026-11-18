# Auditoría humana de conclusiones IA — etapa Exp1 AWS

**Regla:** el LLM no cierra el informe.  
**Modelo:** Ollama `llama3.2:3b` · `simulated=false` · `responseUnmodified=true`

## Exp. 1 AWS — run `evidencias/ai-runs/exp1-latest.json`

| Campo | Valor |
|-------|-------|
| Origen | `JarrisonLopez/defensa-profundidad-caos-2026` @ `1cad076ffed34e70774c3a7dceba941b83660da7` |
| UTC run | 2026-11-18T19:03:34Z → 19:03:44Z |
| `formatStatus` | `valid_json_shape_warning` |
| Errores de formato | **1** — `missing_key:claims` (**no** alucinación) |

### Conteos factuales (autoridad humana)

| Clasificación | Cantidad | Notas |
|---------------|----------|-------|
| **Verificada** | **7** | 5 deterministas + 2 narrativas LLM coherentes con extracto |
| **Incorrecta** | **2** | Controles negativos (misma-evento / SIEM) |
| **No verificable** | **0** | Tras revisión humana de la narrativa LLM |
| **Error de formato** | **1** | Aparte |

> El clasificador automático marcó 2 claims LLM como `no_verificable` por umbral de keywords; la revisión humana las **eleva a verificadas** porque copian el borrador anclado a `FINAL-EXTRACT.sanitized.json` / r0-r1.

### Afirmaciones

| Afirmación | Clasificación | Evidencia |
|------------|---------------|-----------|
| R1 honeytoken → `identity.honeytoken_use`, HTTP 403, `allowed=false` | **verificada** | min.json + r1 |
| Honeytoken no concede acceso (`honeytokenGrantsAccess=false`) | **verificada** | comparison |
| R0 reuseAllowed=8, detections=0 | **verificada** | r0 |
| R1 reuseDenied=8, detections=8, mttdMs=398 (**reuse**, no honeytoken) | **verificada** | r1 |
| Alertamiento = application securityEvent, **not CloudWatch** | **verificada** | comparison.alertingMechanism |
| Resumen LLM: R0_weak vs R1_strict + honeytoken deny | **verificada** (humana) | extracto sanitizado |
| Causa LLM: política débil vs strict; canary siempre deny | **verificada** (humana) | docs + r0/r1 |
| `identity.honeytoken_use` ≡ `identity.reuse_detected` | **incorrecta** | contraste explícito |
| Hubo alerta SIEM/CloudWatch del honeytoken | **incorrecta** | alertingMechanism |
| Timestamp individual del invoke honeytoken | **no_verificable / ausente** | nota en min.json — **no inventar** |
| Latencia específica solo-honeytoken | **no_verificable / ausente** | no confundir con mttdMs reuse |

### Distinción obligatoria

| Evento | Qué es | Evidencia |
|--------|--------|-----------|
| **A. `identity.honeytoken_use`** | Uso del canary → deny 403 | objeto `honeytoken` R0/R1 |
| **B. `identity.reuse_detected`** | Reutilización de token firmado en R1 | métricas reuse / detectionRuleAlerts |

---

## Exp. 2 / Exp. 3 (sin cambio de veredicto etapa 3)

- Exp3: **7** verificadas · formato OK en latest  
- Exp2: **4** verificadas · **1** incorrecta (control NP OKE) · **1** error formato aparte  

## Exp. 4

**PENDIENTE Samuel** — no verificable.

## Totales factuales actualizados (paquete)

| | Verificadas | Incorrectas | No verificables (pendientes) | Errores formato |
|--|-------------|-------------|------------------------------|-----------------|
| Exp1 | 7 | 2 | 0* | 1 |
| Exp2 | 4 | 1 | 0 | 1 |
| Exp3 | 7 | 0 | 0 | 0 |
| Exp4 | 0 | 0 | 1 | 0 |
| **Total** | **18** | **3** | **1** | **2** |

\*Campos ausentes (ts/traceId honeytoken) se documentan como limitaciones, no como “hechos inventados”.
