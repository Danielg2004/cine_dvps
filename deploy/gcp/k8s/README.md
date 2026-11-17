# Despliegue Kubernetes GCP — API Cine (Seguimiento #4)

## Decisión de plataforma

**Elegida: GKE Autopilot** (región `us-central1`, proyecto `cine-devops-canary`).

| Opción | Decisión |
|--------|----------|
| **GKE Autopilot** | Elegida: 2 réplicas, probes, resources nativos, mínimo ops, fácil de borrar |
| GKE Standard | Descartada para lab: nodos fijos más caros |
| K8s en GCE | Descartada: Compute API OFF + operación alta |
| Cloud Run | **No sustituye** Kubernetes (ya existe `cine-api` histórico; no usarlo como entrega K8s) |

**Estado clúster:** no creado. APIs `container`/`compute` **deshabilitadas**. Ver propuesta de autorización en `docs/seguimiento-4/PROPUESTA_AUTORIZACION_GCP.md`.

## Manifiestos incluidos

| Recurso | Detalle |
|---------|---------|
| Namespace | `cine-caos` |
| Deployment | 2 réplicas, probes `/healthz` `/readyz`, requests/limits |
| Sidecar | Cloud SQL Auth Proxy → `cine-mysql-v4` |
| Service | **LoadBalancer** (HTTP público temporal para Sports) |
| ConfigMap | DB loopback, resiliencia, OTEL |
| Secret | crear en clúster (no en git) |
| Ingress | opcional, fuera de kustomize (dominio pendiente) |

## Conexión MySQL

1. **Cloud SQL Auth Proxy sidecar** (elegido) → `DB_HOST=127.0.0.1`
2. Workload Identity: KSA `cine-api` ↔ GSA `cine-gke-sa` con `roles/cloudsql.client`
3. No se modifica IP pública / authorized networks de `cine-mysql-v4` sin autorización aparte

## Aplicar (solo tras autorización)

```bash
kubectl apply -k deploy/gcp/k8s
kubectl -n cine-caos rollout status deployment/cine-api
kubectl -n cine-caos get pods,svc
```

## Reversión / limpieza

```bash
kubectl -n cine-caos rollout undo deployment/cine-api
# Limpieza total del lab (destructivo, autorización aparte):
# kubectl delete -k deploy/gcp/k8s
# gcloud container clusters delete cine-caos-autopilot --region=us-central1 --quiet
```
