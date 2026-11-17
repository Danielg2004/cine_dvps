$ErrorActionPreference = "Continue"
Write-Host "=== Inventario GCP solo lectura (cine-devops-canary) ==="
Write-Host "NO habilita APIs ni crea recursos."

gcloud config get-value account
gcloud config get-value project

Write-Host "`n--- APIs container/compute ---"
gcloud services list --enabled --project=cine-devops-canary --filter="config.name:(container.googleapis.com OR compute.googleapis.com)" --format="value(config.name)"

Write-Host "`n--- Cloud SQL ---"
gcloud sql instances list --project=cine-devops-canary --format="table(name,state,region,settings.tier)"

Write-Host "`n--- Artifact Registry ---"
gcloud artifacts repositories list --project=cine-devops-canary --location=us-central1 --format="table(name,format)"

Write-Host "`n--- Cloud Run ---"
gcloud run services list --project=cine-devops-canary --region=us-central1 --format="table(metadata.name,status.url)"

Write-Host "`n--- GKE clusters (falla si API OFF; esperado) ---"
gcloud container clusters list --project=cine-devops-canary 2>&1 | Out-Host

Write-Host "`n--- Billing ---"
gcloud billing projects describe cine-devops-canary --format="yaml(billingEnabled,billingAccountName)"

Write-Host "`nInventario completo documentado en docs/seguimiento-4/INVENTARIO_GCP_READONLY.md"
