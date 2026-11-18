# Auditoría — lab local de contención (`security:contain-lab`)

**Evidencia:** `local-inject-detect-contain-report.json`  
**Alcance:** laboratorio local sintético — **no** es medición GKE.

## Cadena de eventos

| Evento | Marca / acción | Significado |
|--------|----------------|-------------|
| Inicio del incidente | `faultInjectedAtUtc` | Deja de añadir heartbeats OK (silencio de export simulado en muestras) |
| Detección | `detectedAtUtc` + `detectionStatus=ALERT` | Detector evalúa silencio > `silenceThresholdSec` (60) + margen → ALERT |
| Contención | crea `controls/ABORT` → `killSwitch.abort=true` | Acción concreta del kill switch: **archivo ABORT en FS** (observable) |
| Restauración | nuevo heartbeat OK → `telemetryRestoredAtUtc` | Señal restablecida en muestras; **distinta** de contención |

## ¿Qué ejecutó ABORT realmente?

- **Sí:** creó `seguridad-caos-exp3/controls/ABORT` y el runner lo detectó (`source: file:controls/ABORT`).
- **No:** no deshace exporters OTEL en un proceso vivo ni aplica ConfigMaps (no hay proceso GKE en este lab).
- Tras la prueba el script **elimina** ABORT para no dejar el repo abortado.

## ¿La condición adversa dejó de producir efectos?

En este lab la adversidad es **ausencia de heartbeats en el arreglo de muestras**.  
ABORT marca contención para el runner; la **cesación del efecto observable** (ALERT→OK) ocurre en el paso de **restore** al reintroducir un heartbeat. Por diseño: **contención ≠ restauración**.

## ¿MTTC = 67 s está justificado?

| Métrica | Valor | Cálculo |
|---------|-------|---------|
| MTTD | 65 s | `16:01:51` − `16:00:46` (= umbral 60 + 5 s de margen del script) |
| MTTC | 67 s | `16:01:53` − `16:00:46` (= MTTD + **2 s** deliberados post-ALERT antes de ABORT) |
| restore_sec | 0.5 s | `16:01:53.500` − `16:01:53` |

**Válido como:** demostración local reproducible de la **fórmula** MTTC con side-effect verificable (ABORT), línea temporal sintética coherente (`timelineMode=synthetic_coherent_utc`).

**No válido como:** latencia real de contención en GKE ni tiempo wall-clock de un incidente cloud.

## Diferencia contención vs restauración

- **Contención (MTTC):** instante del kill switch ABORT.  
- **Restauración (restore_sec):** reaparición de heartbeat OK tras contención.
