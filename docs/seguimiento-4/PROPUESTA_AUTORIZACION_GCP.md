# PROPUESTA DE AUTORIZACIÓN — Despliegue GKE Cine

> **Esta propuesta NO es autorización.**  
> No habilitar APIs ni crear recursos facturables hasta respuesta explícita del usuario listando qué aprueba.

## 1. Recursos nuevos a crear

| # | Recurso | Detalle |
|---|---------|---------|
| N1 | API `container.googleapis.com` | Habilitar |
| N2 | API `compute.googleapis.com` | Habilitar (requerida por GKE/LB) |
| N3 | GKE Autopilot `cine-caos-autopilot` | Región `us-central1` |
| N4 | GSA `cine-gke-sa` | `roles/cloudsql.client` (+ AR reader si hace falta pull) |
| N5 | Workload Identity binding | GSA ↔ KSA `cine-caos/cine-api` |
| N6 | Imagen AR `cine-api:5.0.1-caos` (o tag único) | `docker push` |
| N7 | Secret K8s `cine-api-secrets` | DB_USER/DB_PASSWORD/CHAOS_FAULT_TOKEN (valores no en git) |
| N8 | Workloads K8s | namespace, 2 réplicas, proxy, Service LoadBalancer |

## 2. Recursos existentes a reutilizar

- Proyecto `cine-devops-canary`
- Cloud SQL `cine-mysql-v4` + DB `cine_dvps` + user `cine_app`
- Artifact Registry `cine-canary`
- Logging / Monitoring ya ON
- **No** usar Cloud Run como sustituto K8s

## 3. Región y proyecto

`cine-devops-canary` / `us-central1`

## 4. Costos estimados (nuevos)

Ver `COSTOS_ESTIMADOS_GCP.md`.

Orden de magnitud lab: **~0.6–1.5 USD / 4 h**, **~1.2–3 USD / 8 h**, **~3.5–8 USD / 24 h** (aprox., sin egreso alto), más SQL ya existente.

## 5. Comandos de creación (NO ejecutar aún)

```bash
gcloud config set project cine-devops-canary

gcloud services enable container.googleapis.com compute.googleapis.com

gcloud container clusters create-auto cine-caos-autopilot \
  --region=us-central1 \
  --release-channel=regular

gcloud iam service-accounts create cine-gke-sa \
  --display-name="Cine GKE Autopilot Cloud SQL"

gcloud projects add-iam-policy-binding cine-devops-canary \
  --member="serviceAccount:cine-gke-sa@cine-devops-canary.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud iam service-accounts add-iam-policy-binding \
  cine-gke-sa@cine-devops-canary.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:cine-devops-canary.svc.id.goog[cine-caos/cine-api]"

gcloud container clusters get-credentials cine-caos-autopilot \
  --region us-central1

# Build/push (tag único por immutableTags)
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/cine-devops-canary/cine-canary/cine-api:5.0.1-caos .
gcloud auth configure-docker us-central1-docker.pkg.dev
docker push us-central1-docker.pkg.dev/cine-devops-canary/cine-canary/cine-api:5.0.1-caos

kubectl -n cine-caos create namespace cine-caos --dry-run=client -o yaml | kubectl apply -f -
kubectl -n cine-caos create secret generic cine-api-secrets \
  --from-literal=DB_USER=cine_app \
  --from-literal=DB_PASSWORD='***' \
  --from-literal=CHAOS_FAULT_TOKEN='***'

kubectl apply -k deploy/gcp/k8s
```

## 6. Cambios IAM necesarios

- GSA `cine-gke-sa` + `roles/cloudsql.client`
- WI user binding al KSA `cine-caos/cine-api`
- Cuenta humana ya es `roles/owner` (suficiente para create)

## 7. Riesgos

- Costos de clúster/LB si se olvida borrar
- Secretos mal cargados → CrashLoop / readyz fail
- AR immutable tags → fallo al re-pushear mismo tag
- Sin dominio: HTTP en IP efímera del LB (OK para Sports lab)
- Modificar SQL o abrir 0.0.0.0/0 (evitar)

## 8. Reversión

```bash
kubectl -n cine-caos rollout undo deploy/cine-api
```

## 9. Eliminación del lab

```bash
kubectl delete -k deploy/gcp/k8s
gcloud container clusters delete cine-caos-autopilot --region=us-central1 --quiet
# Opcional: borrar GSA cine-gke-sa
# NO borrar Cloud SQL / Cloud Run / AR sin pedido explícito
```

---

## Texto sugerido de autorización

Responde explícitamente, por ejemplo:

> Autorizo N1–N8 en `cine-devops-canary` / `us-central1` con presupuesto máximo de X USD y ventana de Y horas. No autorizo borrar Cloud SQL ni Cloud Run.

Sin ese mensaje, **no** se ejecutará la Etapa 8.
