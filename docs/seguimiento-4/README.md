# Seguimiento #4 — Ingeniería del Caos (API Cine / Daniel)

## Arquitectura multicloud

```
Cliente → Sports (AWS / Jarrison) → Hotel (OCI / Samuel) → Sports → Cine (GCP / Daniel) → Sports → Cliente
```

## Responsabilidades

| Integrante | API | Nube | Experimento | Otros |
|------------|-----|------|-------------|-------|
| Jarrison | Sports | AWS | Latencia Sports→Hotel | k6, chaos gate, coordinador |
| Samuel | Hotel | OCI | Indisponibilidad dependencia | Tablero compartido |
| Daniel | Cine | GCP + Kubernetes | Agotamiento de recursos (concurrencia) | Bulkhead, admission, guía K8s |

## API Cine — endpoint experimental

`GET /api/v2/peliculas/:id` — contrato en `CONTRATOS_MULTICLOUD.md`.

Probes: `/healthz` (liveness), `/readyz` (readiness+DB).

Caos propio: `/api/v3/__test/saturation/*` (token `x-chaos-token`).

Legado canary: `/api/v3/__test/fault` (conservado).

**Chaos Gate S4 (GitHub Actions):** workflow `Cine S4 - Chaos Gate` — evalúa evidencias históricas (`npm run chaos:gate`). No ejecuta caos remoto. Contrato: `CHAOS_GATE_CONTRATO.md`. Distinto del Quality Gate canary Cloud Run.
## Docker y Kubernetes GCP

- Imagen: `Dockerfile` raíz (usuario no-root uid 1000)
- Manifiestos: `deploy/gcp/k8s/` (Autopilot + Cloud SQL Auth Proxy + LoadBalancer)
- Validación: `scripts/validate-k8s.ps1`
- Inventario RO / costos / auth: `INVENTARIO_GCP_READONLY.md`, `COSTOS_ESTIMADOS_GCP.md`, `PROPUESTA_AUTORIZACION_GCP.md`
- **Despliegue real:** GKE Autopilot `cine-caos-autopilot` · LB `http://35.239.107.54` · imagen live `5.0.1-caos-w3c-83efd43`

## Trace ID

Ver `TRAZABILIDAD.md`. E2E tres nubes **no verificado** aún.

## Experimento

- ID: `cine-resource-exhaustion-concurrency-v1`
- Recurso: **concurrencia** (justificación en `chaos/experiment.yaml`)
- Herramienta declarativa: Chaos Toolkit (`chaos/experiments/cine-resource-exhaustion.json`) + wrapper `scripts/chaos/run-chaos-toolkit.ps1`  
  Validación/dry-run: `evidencias/CHAOS_TOOLKIT_VALIDACION.md`. Ejecución GKE real: solo con ventana coordinada (`-RealRun -ConfirmSharedWindow`).  
  Runner Node complementario: `scripts/chaos/run-saturation-experiment.mjs` (no sustituye `chaos run`).
- Métrica: solicitudes exitosas / segundo
- Umbrales: **PENDING_MEASUREMENT** hasta baseline real
- Blast radius: solo `cine-api` / datos sintéticos

## Bulkhead y admission

- R0: `EXPERIMENT_ROUND=r0` → sin protecciones nuevas
- R1: `EXPERIMENT_ROUND=r1` → bulkhead + admission
- Códigos 503 en rechazo (no se maquillan como 200)

## Rondas y evidencias

Ver `PROCEDIMIENTO_RONDAS.md`. Índice de cierre: `CIERRE_EXPERIMENTO_CAOS.md`.

| Familia | Qué mide | Dónde |
|---------|----------|-------|
| k6 local v3 | Throughput comparable baseline/R0/R1 | `evidencias/LAB_K6_V3_SUMMARY.md`, `*-k6-v3.json` |
| k6 GKE v1 / v2 | Idem en cloud (Cine directo) | `LAB_K6_GKE_SUMMARY.md`, `LAB_K6_GKE_V2_SUMMARY.md`, `*-k6-gke*.json` |
| Multicloud 75 s | Sports→flujo→Cine (disp./p95); **no** desglose de patrones | `evidencias/MULTICLOUD_75S_SERIES.md` |
| Sonda bulkhead | `x-reject-reason: bulkhead_timeout` en GKE | `evidencias/gke-v2-reject-probe.json` |
| Sonda admission | `x-reject-reason: inflight_limit` en GKE | `evidencias/gke-admission-reject-probe.json`, `GKE_ADMISSION_PROBE_SUMMARY.md` |

URL pública lab: `http://35.239.107.54`.  
Reproducir verificaciones de lectura: `GET /healthz`, `GET /readyz`, `GET /api/v2/peliculas/1`; sat off vía `GET /api/v3/__test/saturation` (token).  
**No** atribuir eficacia de bulkhead/admission a la serie multicloud 75 s.

## Recuperación

`POST /api/v3/__test/saturation/stop` + verificación `/healthz` (finally del runner).

## Limitaciones y dependencias

- Flujo Sports: `PARA_JARRISON_SPORTS_GKE.md` / `INTEGRACION_SPORTS.md`
- Collector OTLP Samuel (OCI) **activado** y validado en Tempo/Prometheus (`PARA_SAMUEL_OTEL.md`)
- Clúster GKE **creado** (`cine-caos-autopilot`); limpieza post-sustentación pendiente de autorización
- Perfil k6 Cine listo (`load/k6/`); coordinación gate: Jarrison
- Chaos gate CI: Jarrison
- Hipótesis throughput R1>R0: **no confirmada** (local + GKE v1 + GKE v2)
- Patrones en GKE: **demostrados por sondas** (bulkhead + admission), no por multicloud 75 s
- Cierre experimento: `CIERRE_EXPERIMENTO_CAOS.md`

## Uso de IA

Asistente Cursor (Composer) para implementación, pruebas y documentación del Seguimiento #4.

### Alternativas descartadas

| Idea | Motivo |
|------|--------|
| Saturar CPU con busy-loop | Riesgo de nodos/pods; menos seguro |
| OOM intencional | Puede tumbar el nodo; no reversible limpiamente |
| Reutilizar solo Cloud Run | No cumple responsabilidad Kubernetes |
| Reutilizar manifiestos Azure ACR | Nube/registry incorrectos |

## Backlog de resiliencia

- [x] Medir baseline/R0/R1 local con carga ofrecida comparable (k6 v3)
- [x] Ejecutar R0/R1 en GKE con el mismo perfil k6 (v1 + v2; CIERRE_EXPERIMENTO_CAOS.md)
- [ ] Integrar gate de Jarrison
- [x] Cablear OTLP → OCI Samuel en GKE (confirmado por Samuel)
- [ ] Auth servicio-a-servicio Sports→Cine
- [x] Umbrales cloud medidos (GKE v2); hipotesis throughput R1>R0 no confirmada
- [x] Sondas GKE bulkhead + admission documentadas
- [x] Serie multicloud 75 s documentada (sin atribuir patrones)
- [ ] Publicar rama/tag GitHub (autorizacion)
- [ ] Limpieza GCP post-sustentacion (autorizacion)
