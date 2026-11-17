# Protocolo — Experimento multicloud de saturación Cine (coordinado)

**Estado:** PREPARACIÓN — **no ejecutar** hasta ventana acordada con Jarrison y Samuel.  
**Rama Cine:** `seguimiento-4-caos-daniel`  
**URL Cine:** `http://35.239.107.54`  
**Flujo Sports (coordinador):** `http://3.21.120.51:30080/api/v2/flujo/1/1/1`

---

## 1. Recurso realmente saturado

**Concurrencia in-process** (cupos + retención `holdMs`), **no** CPU busy-loop ni OOM.

Mecanismo (`src/chaos/saturation.ts`):

1. Adquiere un cupo (`maxInflight`).
2. Espera `await sleep(holdMs)`.
3. Libera el cupo.
4. Si la cola espera más de `maxQueueWaitMs` → `503` / `saturation_queue_timeout`.

Techo físico aproximado: `maxInflight / (holdMs/1000)` RPS exitosos  
(ej. 8 / 0.25 ≈ **32 RPS** por proceso saturado).

Consumo: event-loop delays + conexiones HTTP concurrentes. No reserva memoria ilimitada.

---

## 2. Endpoints de control (Cine)

Todas requieren header `x-chaos-token` (Secret K8s; **nunca en Git ni en chat**).  
Sin token válido → **404** (ruta oculta).

| Acción | Método | Ruta |
|--------|--------|------|
| Estado | `GET` | `/api/v3/__test/saturation` |
| Arrancar | `POST` | `/api/v3/__test/saturation/start` |
| Parar | `POST` | `/api/v3/__test/saturation/stop` |

Body `start` (JSON):

```json
{
  "holdMs": 250,
  "maxInflight": 8,
  "durationSec": 90,
  "maxQueueWaitMs": 200
}
```

Límites hardcodeados en código: `holdMs≤2000`, `durationSec≤120`, `maxInflight≤32`, `maxQueueWaitMs≤5000`.

**Apagado automático:** sí — `setTimeout` al cumplir `durationSec` (`stopSaturation('timeout'|'expired')`).  
Además existe parada manual `stop`.

---

## 3. Ruta afectada (Sports)

El guard aplica **solo** a:

`GET /api/v2/peliculas/:id`

Es la misma ruta que usa el flujo Sports → Cine.  
Baseline/R0/R1 **sí** son observables vía `GET .../api/v2/flujo/1/1/1` (degradación en dependencia Cine).

Healthz/readyz **no** pasan por saturación ni bulkhead.

---

## 4. Baseline / R0 / R1 (ConfigMap + restart)

Variables en ConfigMap `cine-api-config` (namespace `cine-caos`):

| Ronda | `EXPERIMENT_ROUND` | `RESILIENCE_ENABLED` | Saturación | Bulkhead+Admission |
|-------|--------------------|----------------------|------------|--------------------|
| Baseline | `baseline` | `false` | **off** | off |
| R0 | `r0` | `false` | **on** | off |
| R1 | `r1` | `true` | **on** (misma intensidad) | **on** (orden: bulkhead → admission → sat) |

También fijas entre rondas (no cambiar mid-experiment):

- `BULKHEAD_MAX_CONCURRENT=8`
- `ADMISSION_MAX_INFLIGHT=8` (se acota a ≤ bulkhead)
- `BULKHEAD_ENTER_TIMEOUT_MS=200`

**Requieren reinicio de pods** (env desde ConfigMap): tras `kubectl patch` → `rollout restart deployment/cine-api` y esperar Ready.

---

## 5. Dos réplicas — limitación crítica

La saturación es **estado en memoria del proceso Node**.

`POST .../saturation/start` vía LoadBalancer activa el fallo **solo en el pod que recibe esa request**.

| Opción | Efecto | Uso |
|--------|--------|-----|
| **A (recomendada)** | Escalar a **1 réplica** durante Baseline/R0/R1 | Misma metodología GKE v1/v2; intensidad comparable |
| B | `kubectl exec` start en **cada** pod | Dos procesos saturados; techo ~2×; más riesgo LB/SQL |

**No asumir** que un start por el LB satura ambas réplicas.

Al terminar: **restaurar 2 réplicas** + ConfigMap baseline.

---

## 6. Intensidad idéntica R0/R1

Fijar **antes** de R0 y **no cambiar** en R1:

```text
holdMs=250
maxInflight=8
maxQueueWaitMs=200
durationSec=90   # ≥ ventana k6 75s + margen (máx. 120)
```

Kubernetes: misma imagen, mismos resources, **1 réplica**, mismo LB.  
Único cambio R0→R1: flags de resiliencia (+ restart).

---

## 7. Protección blast radius

| Superficie | Medida |
|------------|--------|
| Sports / Hotel | No inyectar latencia Sports ni 503 Hotel (confirmar responsables) |
| Cloud SQL | Saturación no abre queries extra por sí sola; carga k6 sí lee películas — mantener intensidad conocida |
| OTEL | Dejar export activo; no tocar CA/token |
| Multicloud E2E de otros | Ejecutar solo en **ventana coordinada**; abortar si readiness falla |
| Datos | Solo id sintético `1` |

---

## 8. Perfil k6 75 s (Jarrison) — sin alterar sus parámetros

Cine **no redefine** rate/VUs de Jarrison.

- Jarrison ejecuta **su** perfil k6 de **75 s** contra el **flujo Sports** (mismo script/params en Baseline, R0 y R1).
- Cine solo garantiza: sat `durationSec ≥ 75` (usar **90**), 1 réplica, round flags correctos, stop/restore.

No usar `K6_DURATION` global si anula scenarios; respetar el perfil que Jarrison ya fijó.

Orden por ronda:

1. Configurar round (ConfigMap + restart + Ready).
2. Si R0/R1: `saturation/start` con intensidad fija.
3. Jarrison lanza k6 75 s.
4. `saturation/stop` (aunque exista auto-expiry).
5. Verificar recuperación Cine.
6. Siguiente ronda.

---

## 9. Métricas a registrar

### Cine (Daniel)

- HTTP status del flujo visto en pods / Cloud Logging (`x-trace-id`, 200 vs 503, `x-reject-reason`).
- `GET /api/v3/__test/saturation` → `active`, `chaosInflight`, `appliedCount`.
- Tras ronda: healthz, readyz (`database=up`), películas/1.
- OTEL: spans/métricas `service.name=cine-api` (Samuel).

### Sports (Jarrison)

- Éxito del flujo (`status`, `degraded`, origen Cine).
- Latencia del flujo / dependencia Cine.
- Tasa 5xx / timeouts hacia Cine.
- Throughput del perfil 75 s (el suyo, sin retocar params).

### Samuel (observabilidad)

- Tempo: traces del flujo; spans Cine con mismo Trace ID W3C.
- Prometheus: tasa errores/latencia `cine-api`; no alertas de Hotel experiment 503.
- Confirmar que **no** hay inyección Hotel 503 activa.

---

## 10. Aborto (condiciones concretas)

Abortar de inmediato si:

1. `readyz` falla **>3** sondas consecutivas durante la ronda.
2. Pods en CrashLoop / reinicios repetidos.
3. `saturation/stop` no apaga (`active=true` tras stop) → restart Deployment + scale 2.
4. CPU/memoria de nodo/pod en zona de presión Autopilot (eviction).
5. Hotel o Sports reportan fallo masivo ajeno al experimento Cine.
6. No se puede restaurar 2/2 Ready en ≤5 min.

---

## 11. Rollback / recuperación

```text
1. POST /api/v3/__test/saturation/stop   (+ verificar GET status active=false)
2. ConfigMap: EXPERIMENT_ROUND=baseline, RESILIENCE_ENABLED=false
3. rollout restart deployment/cine-api
4. scale --replicas=2
5. rollout status; readyReplicas=2
6. GET /healthz 200
7. GET /readyz 200 database=up
8. GET /api/v2/peliculas/1 200
9. Flujo Sports smoke 1 request → success, degraded=false
```

---

## 12. Comandos operativos (sin secretos)

```powershell
# Token solo en env local (no imprimir)
# $env:CHAOS_TOKEN = Get-Secret...

$CINE = "http://35.239.107.54"
$H = @{ "x-chaos-token" = $env:CHAOS_TOKEN; "Content-Type" = "application/json" }

# --- PREPARACIÓN ---
kubectl -n cine-caos scale deployment/cine-api --replicas=1
kubectl -n cine-caos rollout status deployment/cine-api --timeout=300s

# Round (ejemplo R0) — patch ConfigMap + restart
# data: EXPERIMENT_ROUND=r0, RESILIENCE_ENABLED=false
kubectl -n cine-caos rollout restart deployment/cine-api
kubectl -n cine-caos rollout status deployment/cine-api --timeout=300s
# Esperar readyz 200

# --- R0 / R1: activar sat ---
Invoke-WebRequest "$CINE/api/v3/__test/saturation/start" -Method POST -Headers $H -Body (@{
  holdMs=250; maxInflight=8; durationSec=90; maxQueueWaitMs=200
} | ConvertTo-Json) -ContentType "application/json"

# Estado
Invoke-RestMethod "$CINE/api/v3/__test/saturation" -Headers @{ "x-chaos-token" = $env:CHAOS_TOKEN }

# Jarrison: k6 75s (SU perfil, sin cambiar params)

# --- Parada ---
Invoke-WebRequest "$CINE/api/v3/__test/saturation/stop" -Method POST -Headers $H -Body "{}" -ContentType "application/json"

# --- RESTORE FINAL ---
# ConfigMap baseline + RESILIENCE_ENABLED=false
kubectl -n cine-caos scale deployment/cine-api --replicas=2
kubectl -n cine-caos rollout restart deployment/cine-api
kubectl -n cine-caos rollout status deployment/cine-api --timeout=300s
```

---

## 13. Checklist antes de la ventana

| # | Ítem | Responsable |
|---|------|-------------|
| 1 | Hotel experiment 503 **OFF** | Samuel (confirmar; Cine no puede verificar) |
| 2 | Sports inyección latencia **OFF** | Jarrison (confirmar) |
| 3 | Cine 2/2 Ready, SQL up, OTEL OK | Daniel |
| 4 | Token caos disponible solo para operadores | Daniel |
| 5 | Acuerdo: 1 réplica durante medición | Todos |
| 6 | Intensidad sat fija R0=R1 | Daniel |
| 7 | k6 75 s idéntico en 3 rondas | Jarrison |
| 8 | Canal aborto / rollback en vivo | Todos |

---

## 14. Riesgos / limitaciones a resolver antes de ejecutar

1. **1 réplica** degrada HA temporalmente — avisar; restaurar sí o sí.
2. Flujo multicloud **incluye Hotel** — latencia/errores de Cine pueden marcar `degraded` en Sports aunque Hotel esté sano.
3. Start por LB ≠ todas las réplicas — usar opción A.
4. `durationSec` máx. **120**; ventana k6 75 s → sat **90** recomendado.
5. Confirmación Hotel/Sports sin fallos ajenos — **pendiente de Samuel/Jarrison**.
6. No fabricar mejora R1 cambiando carga/intensidad entre rondas.
7. Evidencias GKE v1/v2 históricas **no sobrescribir**; usar sufijo nuevo (p. ej. `multicloud-75s`).
