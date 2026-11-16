$ErrorActionPreference = "Stop"

Write-Host "=== Preparacion despliegue GCP (SIN apply remoto) ==="
Write-Host "Proyecto esperado: cine-devops-canary"

$project = gcloud config get-value project 2>$null
Write-Host "Proyecto activo: $project"

Write-Host "`n[A] Solo lectura"
gcloud run services list --project=cine-devops-canary --region=us-central1 --format="table(metadata.name,status.url)" 2>&1 | Out-Host
gcloud sql instances list --project=cine-devops-canary --format="table(name,state,region)" 2>&1 | Out-Host
gcloud artifacts repositories list --project=cine-devops-canary --location=us-central1 --format="table(name,format)" 2>&1 | Out-Host

Write-Host "`n[Validacion local K8s]"
powershell -File (Join-Path $PSScriptRoot "validate-k8s.ps1")

Write-Host "`n[Docker imagen local]"
docker images cine-api:5.0.0-local --format "{{.Repository}}:{{.Tag}} {{.Size}}" 2>&1 | Out-Host

Write-Host "`nBloqueos conocidos:"
Write-Host "- container.googleapis.com no habilitada (GKE)"
Write-Host "- compute.googleapis.com no habilitada"
Write-Host "NO se habilitan APIs ni se crean clusters en este script."
Write-Host "Ver docs/seguimiento-4/DESPLIEGUE_GCP.md"
