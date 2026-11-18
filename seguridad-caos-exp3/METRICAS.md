# Métricas y eventos — Exp. 3 telemetría

## Eventos (marcas UTC obligatorias)

| Evento | Definición precisa |
|--------|-------------------|
| `faultInjectedAtUtc` | Momento en que la falla de export OTEL queda **efectiva** en el proceso bajo prueba (exporters off / SDK disabled observable). |
| `detectedAtUtc` | Momento en que el detector emite **ALERT** (por política: `lastHeartbeatOkAtUtc + silenceThresholdSec`, acotado al reloj de evaluación). |
| `containedAtUtc` | Momento de **contención**: kill switch (`ABORT` / env) o fin explícito de la inyección. **No** requiere que OTEL ya exporte. |
| `telemetryRestoredAtUtc` | Momento en que el heartbeat vuelve a `heartbeatOk=true` de forma sostenida tras restore. |

## Fórmulas

| Métrica | Fórmula | Qué mide |
|---------|---------|----------|
| **MTTD** | `detectedAtUtc − faultInjectedAtUtc` | Tiempo hasta detección |
| **MTTC** | `containedAtUtc − faultInjectedAtUtc` | Tiempo hasta **contención** |
| **restore_sec** | `telemetryRestoredAtUtc − containedAtUtc` | Tiempo de **restauración** de telemetría (distinto de MTTC) |
| **FP pre-inyección** | Nº de ALERT con detector armado **antes** de `faultInjectedAtUtc` | Falsos positivos (objetivo: 0) |

## Anti-confusiones

- **MTTC ≠ restore.** Contener (parar el caos / activar kill switch) no implica que Tempo/Prom ya reciban spans otra vez.
- **Silencio HTTP ≠ pérdida OTEL.** Solo el heartbeat canónico arma y alimenta el detector.
- **NOT_ARMED ≠ OK de seguridad cloud.** Significa “aún no hay baseline de telemetría para alertar”; en R0/R1 reales hay que armar antes de inyectar.

## Lab OTLP local (`npm run security:otlp-lab`) — alcance de métricas

| Evento / métrica | En el lab local | ¿Validado como contención operativa? |
|------------------|-----------------|--------------------------------------|
| `faultInjectedAtUtc` | Shutdown del `MeterProvider` exportador OTLP | Sí (inicio de falla de export) |
| `detectedAtUtc` | Primera evaluación ALERT del adaptador externo | Sí (detección) → **MTTD** |
| `containedAtUtc` | Marca inmediata post-ALERT en el script (ack de fallo detectado) | **No** — no activa kill switch ni un procedimiento de contención independiente |
| `telemetryRestoredAtUtc` | Reaparición de heartbeats vía OTLP tras recrear exportador | Sí (restauración de señal) → **restore_sec** |
| campo `MTTC_sec` en evidencia | `containedAtUtc − faultInjectedAtUtc` ≈ MTTD | **No presentar como MTTC de contención validado** |

En R0/R1 reales, `containedAtUtc` debe ser el instante del kill switch / stop de inyección (`controls/ABORT` o equivalente), distinto de `telemetryRestoredAtUtc`.

## Contención observable (diseño MTTC)

Acción verificable local (y la misma en el runner GKE futuro):

1. Tras `detectedAtUtc`, el runner **crea** `seguridad-caos-exp3/controls/ABORT` (o exporta `CINE_TELEMETRY_CHAOS_ABORT=1`).
2. El runner comprueba que el flag es detectable → registra `containedAtUtc`.
3. Solo entonces inicia restore de exporters / heartbeats → `telemetryRestoredAtUtc`.

Script reproducible (sin cloud):

```bash
node seguridad-caos-exp3/scripts/local-inject-detect-contain.mjs
```

Produce `evidencias-locales/local-inject-detect-contain-report.json` con `MTTD_sec` y `MTTC_sec` separados de `restore_sec`.

## Cobertura de detección (diseño)

Mínimo declarado para Exp. 3 telemetría:

1. Señal heartbeat (métrica/span periódica) — **requerida**.  
2. (Opcional posterior) ausencia de export traces **y** metrics como comprobación cruzada — no implementada en esta fase.

No se inventan valores MTTD/MTTC de corridas GKE: solo se definen eventos y helpers de cálculo sobre marcas aportadas.
