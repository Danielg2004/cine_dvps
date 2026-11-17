# Limpieza post-sustentación (NO ejecutar sin autorización)

## Eliminar lab Seguimiento #4

```bash
kubectl delete -k deploy/gcp/k8s
gcloud container clusters delete cine-caos-autopilot \
  --project=cine-devops-canary --region=us-central1 --quiet
# Opcional: gcloud iam service-accounts delete cine-gke-sa@cine-devops-canary.iam.gserviceaccount.com
```

## Conservar

- Cloud SQL `cine-mysql-v4`
- Cloud Run `cine-api` histórico
- Artifact Registry `cine-canary` (salvo tags explícitos a borrar)
