# Despliegue GKE ejecutado — Continuación #5

**Autorización:** N1–N8 (ventana 8 h, presupuesto ref. USD 10)  
**Proyecto:** `cine-devops-canary` · **Región:** `us-central1`  
**Fecha:** 2026-11-16 / 2026-11-17 UTC  
**HEAD al build:** `110f734` · imagen `5.0.1-caos-110f734`

## URL pública (real)

```
http://35.239.107.54
```

| Check | Resultado |
|-------|-----------|
| `GET /healthz` | 200 `{"status":"ok","probe":"liveness"}` |
| `GET /readyz` | 200 `database":"up"` |
| `GET /api/v2/peliculas/1` + `x-trace-id` | 200, origen `database` |

Experimentos k6 GKE (Continuación #6): ejecutados — ver `evidencias/LAB_K6_GKE_SUMMARY.md`.  
Hipótesis throughput en cloud: **NO confirmada** (R1 21.4 vs R0 28.6 RPS).

## Recursos creados (nuevos)

| Recurso | Nombre / detalle |
|---------|------------------|
| API | `container.googleapis.com`, `compute.googleapis.com` |
| GKE Autopilot | `cine-caos-autopilot` (RUNNING, 1.36.4-gke.2377000) |
| GSA | `cine-gke-sa@cine-devops-canary.iam.gserviceaccount.com` |
| IAM | `roles/cloudsql.client` + WI `cine-caos/cine-api` |
| Imagen AR | `…/cine-api:5.0.1-caos-110f734` |
| Namespace | `cine-caos` |
| Secret K8s | `cine-api-secrets` (desde Secret Manager; valores no en git) |
| Deployment | `cine-api` **2/2 Ready** (+ sidecar Cloud SQL Auth Proxy) |
| Service LB | `cine-api` → EXTERNAL-IP `35.239.107.54` |

## Recursos NO modificados / no borrados

- Cloud SQL `cine-mysql-v4`
- Cloud Run `cine-api`
- Recursos históricos / imágenes canary previas

## Estado Kubernetes (al verificar)

- Réplicas: **2/2 Running**, containers Ready (api + proxy)
- Rollout: successful
- Probes: liveness `/healthz`, readiness `/readyz` (fallos iniciales de arranque, luego OK)

## Costos observables

| Ítem | Observación |
|------|-------------|
| Estimación previa 8 h | ~1.2–3 USD recursos nuevos (aprox.) |
| Presupuesto ref. | USD 10 |
| Créditos Free Trial | **No legibles por CLI** |
| Factura en tiempo real | No disponible vía gcloud sin Billing Export |
| Recursos que siguen cobrando si no se limpian | Autopilot cluster, LoadBalancer/IP, pods; SQL/AR/Run históricos aparte |

## Limpieza (NO ejecutar sin autorización)

```bash
kubectl delete -k deploy/gcp/k8s
gcloud container clusters delete cine-caos-autopilot \
  --project=cine-devops-canary --region=us-central1 --quiet
# Opcional: borrar solo GSA cine-gke-sa
# NO borrar Cloud SQL / Cloud Run / AR sin pedido explícito
```
