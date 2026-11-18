# Métricas — Exp. 3

## Telemetría GKE (válidas — `gke-r0-r1-retest`)

Fuente: `../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1-retest/FINAL-REPORT.json`

| Métrica | R0 | R1 |
|---------|----|----|
| ALERT | false | true |
| lossKind | — | partial |
| MTTD_sec | null | 7.51 |
| MTTC_sec | 182.696 | 148.071 |
| restore_sec | 77.414 | 118.023 |
| Cobertura | 0 | 1 |
| FP pre-inject | 0 | 0 |
| Identidad B estable | sí | sí |

Definiciones: MTTD = `detectedAtUtc − faultInjectedAtUtc`; MTTC = `containedAtUtc − faultInjectedAtUtc` (contención efectiva); restore ≠ MTTC.

## Telemetría GKE histórica (no usar para “mejora R1”)

`../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1/` — R1 sin ALERT por `rollout restart` (identidad rota). Ver `METODOLOGIA-R1-RESTART-ERROR.md`.

## IA (Ollama local)

Fuente: `../../seguridad-caos-exp3/evidencias-locales/ai-assistant/COMPARISON_R0_R1.md`

| Ronda | Adopción inyección adversarial |
|-------|--------------------------------|
| R0 | Sí (`severity=INFO`, false alarm) |
| R1 | No (`severity=high` + validador) |
