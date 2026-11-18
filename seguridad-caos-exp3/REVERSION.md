# Reversión e interruptor de parada — Exp. 3 telemetría

**Estado:** procedimiento documentado para verificación previa.  
**Esta fase no ejecuta** `kubectl`, ni modifica ConfigMaps/Secrets, ni aplica cambios en GCP.

## Kill switch (contención)

| Mecanismo | Activación | Efecto esperado en un runner futuro |
|-----------|------------|-------------------------------------|
| Archivo | Crear `seguridad-caos-exp3/controls/ABORT` | Abortar inyección; registrar `containedAtUtc` |
| Entorno | `CINE_TELEMETRY_CHAOS_ABORT=1` | Igual |

Plantilla: `controls/ABORT.example` (no activa el switch).

Verificación local (sin GCP):

```bash
node seguridad-caos-exp3/scripts/verify-kill-switch.mjs
```

**MTTC** usa el instante de contención (`containedAtUtc`), **no** el de restauración OTEL.

## Restauración de telemetría (post-contención)

Pasos previstos **solo cuando haya autorización de ejecución real** (no en esta fase):

1. Restaurar exporters OTEL en ConfigMap a valores de baseline del lab:
   - `OTEL_TRACES_EXPORTER=otlp`
   - `OTEL_METRICS_EXPORTER=otlp`
   - `OTEL_SDK_DISABLED` ausente/false
   - Endpoint/CA/headers según `deploy/gcp/k8s/configmap.yaml` + secret OTEL existente
2. Aplicar ConfigMap y rollout (comandos GCP — **fuera de esta fase**).
3. Alternativa documentada ya existente: reutilizar el flujo de `scripts/gcp-apply-otel-oci.ps1` (restore), sin inventar endpoints.
4. Confirmar heartbeats `cine.telemetry.heartbeat` OK otra vez → `telemetryRestoredAtUtc`.
5. Confirmar detector `status=OK` y `alert=false`.

## Separación de tiempos

| Evento | Uso |
|--------|-----|
| `faultInjectedAtUtc` | Inicio falla export |
| `detectedAtUtc` | Primera ALERT del detector → **MTTD** |
| `containedAtUtc` | Kill switch / stop inyección → **MTTC** |
| `telemetryRestoredAtUtc` | Heartbeats OK de nuevo → **restore_sec** (≠ MTTC) |

## Comprobaciones pre-vuelo (locales)

- [x] Detector + política versionados
- [x] `verify-kill-switch.mjs` pasa
- [ ] Autorización Samuel/Jarrison / dueño GCP (pendiente humano)
- [ ] Heartbeat runtime en pods (dependencia pendiente; ver README)
- [ ] Ejecución R0/R1 en GKE (bloqueada hasta autorización)
