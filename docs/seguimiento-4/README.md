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

## Docker y Kubernetes GCP

- Imagen: `Dockerfile` raíz (usuario no-root uid 1000)
- Manifiestos: `deploy/gcp/k8s/` (Autopilot + Cloud SQL Auth Proxy + LoadBalancer)
- Validación: `scripts/validate-k8s.ps1`
- Inventario RO / costos / auth: `INVENTARIO_GCP_READONLY.md`, `COSTOS_ESTIMADOS_GCP.md`, `PROPUESTA_AUTORIZACION_GCP.md`
- **Despliegue real:** GKE Autopilot `cine-caos-autopilot` · LB `http://35.239.107.54` · imagen live `5.0.1-caos-r1guard-f46e5f4`

## Trace ID

Ver `TRAZABILIDAD.md`. E2E tres nubes **no verificado** aún.

## Experimento

- ID: `cine-resource-exhaustion-concurrency-v1`
- Recurso: **concurrencia** (justificación en `chaos/experiment.yaml`)
- Herramienta declarativa: Chaos Toolkit + runner `scripts/chaos/run-saturation-experiment.mjs`
- Métrica: solicitudes exitosas / segundo
- Umbrales: **PENDING_MEASUREMENT** hasta baseline real
- Blast radius: solo `cine-api` / datos sintéticos

## Bulkhead y admission

- R0: `EXPERIMENT_ROUND=r0` → sin protecciones nuevas
- R1: `EXPERIMENT_ROUND=r1` → bulkhead + admission
- Códigos 503 en rechazo (no se maquillan como 200)

## Rondas

Ver `PROCEDIMIENTO_RONDAS.md`.  
Serie local oficial comparable: **k6 v3** (`npm run chaos:lab:k6`) — `evidencias/LAB_K6_V3_SUMMARY.md`.  
Serie cloud GKE v1: `evidencias/LAB_K6_GKE_SUMMARY.md` (`*-k6-gke.json`).  
Serie cloud GKE v2 (post-fix): `evidencias/LAB_K6_GKE_V2_SUMMARY.md` (`*-k6-gke-v2.json`).  
URL pública lab: `http://35.239.107.54`.

## Recuperación

`POST /api/v3/__test/saturation/stop` + verificación `/healthz` (finally del runner).

## Limitaciones y dependencias

- URLs/contratos Sports y Hotel pendientes (plantilla: `PARA_JARRISON_SPORTS_GKE.md`)
- Collector OTLP Samuel (OCI) **activado en GKE** (CA+Basic); confirmación Tempo/Prometheus pendiente (`PARA_SAMUEL_OTEL.md`)
- Clúster GKE **creado** (`cine-caos-autopilot`); limpieza post-sustentación pendiente de autorización
- Perfil k6 Cine listo (`load/k6/`); coordinación gate: Jarrison
- Chaos gate CI: Jarrison
- Hipótesis throughput R1>R0: **no confirmada** (local + GKE v1 + GKE v2)
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
- [ ] Ejecutar R0/R1 en GKE con el mismo perfil k6
- [ ] Integrar gate de Jarrison
- [x] Cablear OTLP → OCI Samuel en GKE (exporter OK localmente; falta confirmación Tempo/Prom de Samuel)
- [ ] Auth servicio-a-servicio Sports→Cine
- [ ] Fijar umbrales cloud tras baseline GCP
