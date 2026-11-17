# Procedimiento de despliegue GCP — API Cine (Seguimiento #4)

Documentos vivos:

- Inventario RO: `INVENTARIO_GCP_READONLY.md`
- Costos: `COSTOS_ESTIMADOS_GCP.md`
- Créditos / Free Trial: `CREDITOS_GCP_VERIFICACION.md` (**saldo no legible por CLI**)
- **Autorización requerida:** `PROPUESTA_AUTORIZACION_GCP.md`

## Decisión de infraestructura

**GKE Autopilot** en `us-central1` — más simple/económica que Standard o K8s en GCE para 2 réplicas académicas.  
**Cloud Run no sustituye** la entrega Kubernetes.

## Inventario (lectura, Continuación #5)

| Recurso | Estado |
|---------|--------|
| Proyecto | `cine-devops-canary` (billing ON, owner) |
| Cloud Run `cine-api` | Existe (histórico) |
| Cloud SQL `cine-mysql-v4` | RUNNABLE MySQL 8 / `db-f1-micro` |
| Artifact Registry `cine-canary` | Existe (~1.26 GB, tags inmutables) |
| GKE / Compute APIs | **OFF** |
| Clúster K8s | **No existe** |

## Manifiestos locales listos

`deploy/gcp/k8s/`: 2 réplicas, probes, resources, Cloud SQL Auth Proxy sidecar, Service LoadBalancer, ConfigMap, SA WI annotation.

Validación: `npm run validate:k8s`

## A) Solo lectura

```bash
gcloud config get-value project
gcloud sql instances list --project=cine-devops-canary
gcloud artifacts repositories list --project=cine-devops-canary --location=us-central1
gcloud container clusters list --project=cine-devops-canary
```

## B) Facturable — NO ejecutar sin autorización explícita

Ver comandos en `PROPUESTA_AUTORIZACION_GCP.md` (N1–N8).

## Estado de ejecución cloud

| Paso | Estado |
|------|--------|
| Inventario RO | Hecho |
| Manifiestos Autopilot | Hechos |
| Habilitar APIs | **Hecho** (autorizado N1–N8) |
| Crear Autopilot | **Hecho** `cine-caos-autopilot` |
| Push imagen | **Hecho** `5.0.1-caos-r1guard-f46e5f4` (live) · previa `5.0.1-caos-110f734` |
| Apply K8s | **Hecho** 2/2 Ready |
| URL pública LB | **http://35.239.107.54** |
| Experimentos k6 GKE v1 | **Hecho** (`*-k6-gke.json`) |
| Experimentos k6 GKE v2 | **Hecho** (`*-k6-gke-v2.json`) · hipótesis throughput NO confirmada |

Evidencia: `DESPLIEGUE_GKE_EJECUTADO.md`

Script RO: `scripts/prepare-gcp-deploy.ps1`
