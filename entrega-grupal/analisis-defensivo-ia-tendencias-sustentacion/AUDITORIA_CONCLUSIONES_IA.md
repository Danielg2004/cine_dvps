# Auditoría humana de conclusiones IA — cuatro experimentos

**Regla:** el LLM no es fuente de verdad.  
**Modelo:** Ollama `llama3.2:3b` · `simulated=false`

## Exp. 4 — run `evidencias/ai-runs/exp4-latest.json`

| Campo | Valor |
|-------|-------|
| Origen | `sgiraldor/hotel-fastify` @ `d5e72f6e4a5043008091fe80559f0f1952bcad43` |
| UTC | 2026-11-18T21:28:55Z → 21:29:07Z |
| Formato | `valid_json_shape_warning` · **1** error (`missing_key:claims`) — **no** alucinación |

### Conteos factuales (autoridad humana)

| Clasificación | # | Notas |
|---------------|---|-------|
| **Verificada** | **8** | 6 métricas deterministas + resumen LLM + causa (metodología) |
| **Incorrecta** | **3** | Controles: 16/16, integrity⇒RPO0, n>1 |
| **No verificable** | **0** | Tras elevación humana de la causa |
| **Error formato** | **1** | Aparte |

### Tabla de afirmaciones Exp.4

| Afirmación | Clasificación | Evidencia | Ruta |
|------------|---------------|-----------|------|
| RPO R0=3629 ms (3.629 s); R1=2209 ms (2.209 s) | **verificada** | `rpo_observed_from_backup_age_ms` | `r0/metrics.json`, `r1/metrics.json` |
| RTO R0=13056 ms; R1=1792 ms | **verificada** | `rto_observed_ms` | mismo |
| MTTD R0=0.300 s; R1=0.109 s | **verificada** | `t_deteccion−t_fallo` | mismo |
| Commits R0 10/16; R1 13/16 (perdidos 6 y 3) | **verificada** | commits_* | mismo |
| Integridad PASS + recuperación PASS R0/R1 | **verificada** | integrity.* + `t_servicio_ok` | mismo |
| ΔRPO 39.1% · ΔRTO 86.3% (n=1) | **verificada** | recalc + RESULTADOS | `RESULTADOS-OCI-20261118.md` |
| R0 manual; R1 G1+G2 auto; n=1 | **verificada** | docs 05 + metrics | `docs/05-r0-r1-g1-g2.md` |
| RPO=antigüedad backup; RTO incluye espera humana en R0 | **verificada** | metodología | `docs/06-metricas-rpo-rto.md` |
| 16/16 commits / pérdida=0 | **incorrecta** | lost 6/3 | metrics |
| Integridad PASS ⇒ RPO=0 | **incorrecta** | H8: pérdida≠corrupción | `06-metricas` |
| Garantía estadística / n>1 | **incorrecta** | n=1 | RESULTADOS / extract |

### Unidades

Docs Samuel usan coma decimal: **3,629 s = 3.629 s = 3629 ms**.

---

## Totales paquete (Exp1–4)

| Exp | Verificadas | Incorrectas | No verificables | Errores formato |
|-----|-------------|-------------|-----------------|-----------------|
| 1 AWS | 7 | 2 | 0 | 1 |
| 2 OCI red | 4 | 1 | 0 | 1 |
| 3 GCP tel | 7 | 0 | 0 | 0 |
| 4 OCI datos | 8 | 3 | 0 | 1 |
| **Total** | **26** | **6** | **0** | **3** |

Veredictos Exp1–3 previos se conservan (ver historial en `evidencias/ai-runs/`).
