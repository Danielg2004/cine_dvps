# Análisis defensivo con IA — cuatro experimentos

## Diseño

| Propiedad | Decisión |
|-----------|----------|
| Modelo | Ollama real `llama3.2:3b` |
| Allowlist | `config/evidence-allowlist.json` |
| Autoridad | Borrador determinista + auditoría humana |
| Formato | `formatErrors` ≠ factuales |

## Tabla definitiva

| Exp | Responsable | Nube | Escenario | Mejora | R0 | R1 | Métrica principal | Evidencia | Limitaciones |
|-----|-------------|------|-----------|--------|----|----|-------------------|-----------|--------------|
| 1 | Jarrison | AWS lab | Identidad + honeytoken | Strict + canary | reuse 8/0 det; honey 403 | reuse 8/8 MTTD 398 ms; honey 403 | `identity.honeytoken_use` ≠ reuse | repo grupal `1cad076` (extractos) | No SIEM; sin ts honey |
| 2 | Samuel | OCI lab Docker | Acceso L4 no auth | Política restrictiva | sin detección | block+alert mttd 20 ms | cobertura/alerta | summaries `742c575a` | No NP OKE prod |
| 3 | Daniel | GCP GKE lab | Telemetría parcial | Detector by-instance | no alert parcial | alert partial MTTD 7.51 s | MTTD/MTTC/coverage | `gke-r0-r1-retest` | NS efímero; R1 restart inválida |
| 4 | Samuel | OCI VM | Pérdida/restore datos | G1 backup mid + G2 restore auto | RPO 3.629 s · RTO 13.056 s · 10/16 | RPO 2.209 s · RTO 1.792 s · 13/16 | RPO/RTO/MTTD | `d5e72f6e` públicas | n=1; integrity≠RPO0 |

## Exp. 4 (detalle)

- **Hipótesis:** con G1+G2 bajan RPO/RTO vs restore manual (misma carga 16 commits).
- **Metodología Samuel:** RPO observado = `t_fallo − t_backup` del backup restaurado; RTO = `t_servicio_ok − t_fallo`; MTTD = `t_deteccion − t_fallo`.
- **Δ verificados:** RPO −39.1 %; RTO −86.3 %.
- **Run IA:** `evidencias/ai-runs/exp4-latest.json` (`llm_real_ollama`).

IA = interpretación auditada; métricas = JSON de Samuel.
