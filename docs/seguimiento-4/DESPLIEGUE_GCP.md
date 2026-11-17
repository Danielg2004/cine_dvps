# Procedimiento de despliegue GCP — API Cine (Seguimiento #4)

Documentos vivos:

- Inventario RO: `INVENTARIO_GCP_READONLY.md`
- Costos: `COSTOS_ESTIMADOS_GCP.md`
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
| Manifiestos Autopilot | Hechos (local) |
| Habilitar APIs | **PENDIENTE autorización** |
| Crear Autopilot | **PENDIENTE autorización** |
| Push imagen | **PENDIENTE autorización** |
| Apply K8s | **PENDIENTE autorización** |
| URL pública LB | **No existe aún** |
| Experimentos k6 cloud | **No ejecutados** |

Script RO: `scripts/prepare-gcp-deploy.ps1`
