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

## Cobertura de detección (diseño)

Mínimo declarado para Exp. 3 telemetría:

1. Señal heartbeat (métrica/span periódica) — **requerida**.  
2. (Opcional posterior) ausencia de export traces **y** metrics como comprobación cruzada — no implementada en esta fase.

No se inventan valores MTTD/MTTC de corridas GKE: solo se definen eventos y helpers de cálculo sobre marcas aportadas.
