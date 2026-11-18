# Runbook R0/R1 telemetría (GKE lab) — ejecución pendiente de aprobación

## Reglas de compromiso

1. Misma inyección en R0 y R1 (`otel-exporter-disable`).
2. No saturar con k6; no tocar Cloud SQL; no Sports AWS / Hotel OCI.
3. Kill switch verificado en seco (`npm run security:telemetry-verify`) antes de la ventana.
4. Marcas UTC obligatorias: `faultInjectedAtUtc`, `detectedAtUtc`, `containedAtUtc`, `telemetryRestoredAtUtc`.

## Mejora R0 → R1 (telemetría)

| Ronda | Detección |
|-------|-----------|
| R0 | Agregada (todas las instancias) |
| R1 | Por instancia (`evaluateTelemetrySilenceByInstance`) → `lossKind` partial\|total |

## Contención observable (MTTC)

Acción verificable: crear `controls/ABORT` **o** `CINE_TELEMETRY_CHAOS_ABORT=1` en el runner.  
Ese instante = `containedAtUtc`. **No** usar el tiempo de restore como MTTC.

## Secuencia

1. Steady state: healthz/readyz OK; detector armado; FP pre-inyección = 0.
2. Aplicar overlay inject (**solo con aprobación**) + rollout lab.
3. Registrar `faultInjectedAtUtc` cuando exporters=none efectivos.
4. Observar ALERT → `detectedAtUtc` (MTTD).
5. Activar kill switch → `containedAtUtc` (MTTC).
6. Aplicar overlay baseline + confirmar heartbeats → `telemetryRestoredAtUtc`.
7. Eliminar `controls/ABORT` tras cierre documentado.

## Scripts locales de ensayo (sin cloud)

```bash
npm run security:telemetry-verify
node seguridad-caos-exp3/scripts/local-inject-detect-contain.mjs
npm run security:otlp-lab
```
