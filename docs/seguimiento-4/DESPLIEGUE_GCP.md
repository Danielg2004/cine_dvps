# Procedimiento de despliegue GCP — API Cine (Seguimiento #4)

## Inventario verificado (solo lectura, 2026-11-16)

| Recurso | Estado |
|---------|--------|
| Proyecto | `cine-devops-canary` (activo en gcloud) |
| Cloud Run `cine-api` | **Existe** — URL `https://cine-api-evr4elf76q-uc.a.run.app` |
| Cloud SQL `cine-mysql-v4` | **RUNNABLE** MySQL 8.0, `db-f1-micro`, us-central1 |
| Artifact Registry `cine-canary` | **Existe** (DOCKER, us-central1, ~1.2 GB) |
| GKE | **API `container.googleapis.com` NO habilitada** (403) |
| Compute Engine API | **NO habilitada** |
| APIs ON | run, sqladmin, artifactregistry, logging, monitoring, … |
| SA relevantes | `cine-github-deploy-sa@…`, `cine-run-sa@…` |

## Arquitectura recomendada (sin crear aún)

Comparación para lab académico temporal:

| Opción | Pros | Contras | Cumple K8s Daniel |
|--------|------|---------|-------------------|
| **GKE Autopilot** | Operación mínima, escala a 0/bajo, probes/resources nativos | API hoy OFF; costo pod-time | Sí |
| GKE Standard | Control fino de nodos | Más caro/complejo para 2 pods | Sí |
| K8s en GCE | Máximo control | Compute API OFF; operación alta | Sí |
| Solo Cloud Run | Ya existe `cine-api` | **No es Kubernetes** | No |

**Recomendación:** GKE Autopilot de vida corta + Cloud SQL/`cine-mysql-v4` + Artifact Registry existentes.

Compatibilidad del experimento: saturación/admission son in-process (HTTP); no requieren privilegios de nodo. Funcionan en Autopilot. Chaos Toolkit actúa vía HTTP al Service/Ingress.

### Estimación de costos (orientativa, no factura)

| Recurso | Estimación | Verificado en Billing |
|---------|------------|------------------------|
| GKE Autopilot (2 pods 100m–500m CPU / 256–512Mi, lab días) | ~USD 5–25 en periodo corto de demo | **No** |
| Cloud SQL `db-f1-micro` | ya existe | Estado RUNNABLE sí |
| Artifact Registry | storage ya presente (~1.2 GB) | Tamaño sí |
| Egreso Sports→Cine | variable | No |

**No se afirma un costo exacto sin Billing API.** Priorizar destruir el clúster al terminar la demo.

---

## A) Comandos de solo lectura

```bash
gcloud config get-value project
gcloud run services list --project=cine-devops-canary --region=us-central1
gcloud sql instances list --project=cine-devops-canary
gcloud artifacts repositories list --project=cine-devops-canary
gcloud container clusters list --project=cine-devops-canary
kubectl config get-contexts
```

## B/C) Comandos que modifican infra / generan costos — **NO ejecutar sin autorización**

1. Habilitar APIs: `container.googleapis.com`, `compute.googleapis.com`
2. Crear clúster Autopilot
3. Crear secretos K8s / Workload Identity
4. `docker push` a Artifact Registry (storage)
5. `kubectl apply -k deploy/gcp/k8s`
6. Crear Ingress / IP / certificados
7. Abrir conectividad Cloud SQL ↔ GKE

### Secuencia propuesta (cuando autoricen)

```bash
# 1) Proyecto
gcloud config set project cine-devops-canary

# 2) (COSTO) habilitar APIs — REQUIERE AUTORIZACIÓN
# gcloud services enable container.googleapis.com compute.googleapis.com

# 3) (COSTO) clúster Autopilot — REQUIERE AUTORIZACIÓN
# gcloud container clusters create-auto cine-caos-autopilot --region=us-central1

# 4) Build + push imagen
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/cine-devops-canary/cine-canary/cine-api:5.0.1 .
gcloud auth configure-docker us-central1-docker.pkg.dev
docker push us-central1-docker.pkg.dev/cine-devops-canary/cine-canary/cine-api:5.0.1

# 5) Secretos (sin commitear valores)
kubectl -n cine-caos create secret generic cine-api-secrets \
  --from-literal=DB_USER=... \
  --from-literal=DB_PASSWORD=... \
  --from-literal=CHAOS_FAULT_TOKEN=...

# 6) Apply manifiestos
kubectl apply -k deploy/gcp/k8s
kubectl -n cine-caos rollout status deploy/cine-api

# 7) Validar
kubectl -n cine-caos get pods,svc
curl -sS https://<INGRESS>/healthz
curl -sS https://<INGRESS>/api/v2/peliculas/1 -H "x-trace-id: sports-1"

# 8) Rollback
kubectl -n cine-caos rollout undo deploy/cine-api

# 9) Limpieza posterior (destructivo — autorización aparte)
# kubectl delete -k deploy/gcp/k8s
# gcloud container clusters delete cine-caos-autopilot --region=us-central1
```

Script de preparación local (sin apply remoto): `scripts/prepare-gcp-deploy.ps1`
