$ErrorActionPreference = "Stop"

Write-Host "=== Preparacion despliegue GCP (SIN apply remoto / SIN costos nuevos) ==="
Write-Host "Proyecto esperado: cine-devops-canary"

$project = gcloud config get-value project 2>$null
Write-Host "Proyecto activo: $project"

Write-Host "`n[A] Solo lectura"
& (Join-Path $PSScriptRoot "gcp-inventory-readonly.ps1")

Write-Host "`n[Validacion local K8s]"
powershell -File (Join-Path $PSScriptRoot "validate-k8s.ps1")

Write-Host "`n[Docker imagen local opcional]"
docker images "us-central1-docker.pkg.dev/cine-devops-canary/cine-canary/cine-api" --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}" 2>&1 | Out-Host

Write-Host "`nBloqueos conocidos:"
Write-Host "- container.googleapis.com / compute.googleapis.com OFF"
Write-Host "- Sin clúster GKE"
Write-Host "NO se habilitan APIs ni se crean clusters en este script."
Write-Host "Autorizacion: docs/seguimiento-4/PROPUESTA_AUTORIZACION_GCP.md"
