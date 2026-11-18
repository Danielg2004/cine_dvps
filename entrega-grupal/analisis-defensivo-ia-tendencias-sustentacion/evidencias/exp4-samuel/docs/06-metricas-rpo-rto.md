# Metodología RPO / RTO

## Definiciones

| Término | Significado |
|---|---|
| RPO **objetivo** | Intervalo de backup configurado (p. ej. 300 s / 30 s) |
| Antigüedad del respaldo | `t_fallo - t_backup` del backup restaurado |
| RPO **observado** | Pérdida de datos confirmados no recuperados + reporte de antigüedad del respaldo |
| RTO **objetivo** | Umbral académico acordado (documental) |
| RTO **observado** | `t_servicio_ok - t_fallo` |

## Fórmulas implementadas (`scripts/compute-metrics.py`)

- `rto_observed_ms = t_servicio_ok - t_fallo` (sonda independiente; incertidumbre ≈ intervalo de probe, default 1 s)
- `rpo_observed_from_backup_age_ms = t_fallo - t_backup` del **backup_id restaurado** (H11)
- `confirmed_commits_lost = commits_before_fault - commits_restored`
- `t_deteccion` desde `alerts.jsonl` (`lab_event_observed`); si no hay → `not_observed` / `null` (H6)

Si faltan eventos → campos `null` (no inventar).

## Integridad (H8)

Post-restore: consulta funcional, identidad `lab_meta`, conteo vs commits del ledger ≤ `t_backup_end`, orden por `id` monotónico (H7). Pérdida post-backup = RPO, no corrupción.
