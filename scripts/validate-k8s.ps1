$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$k8s = Join-Path $root "deploy\gcp\k8s"

Write-Host "Validando manifiestos en $k8s"

$files = @(
    "namespace.yaml",
    "configmap.yaml",
    "deployment.yaml",
    "service.yaml",
    "ingress.yaml",
    "kustomization.yaml"
)

foreach ($file in $files) {
    $path = Join-Path $k8s $file
    if (-not (Test-Path $path)) {
        throw "Falta archivo: $path"
    }
    Write-Host "OK existe $file"
}

$kubectl = Get-Command kubectl -ErrorAction SilentlyContinue
if ($null -eq $kubectl) {
    Write-Host "kubectl no instalado: se valida solo presencia de archivos YAML."
    exit 0
}

Push-Location $k8s
try {
    Write-Host "Ejecutando kubectl kustomize (render)..."
    $rendered = kubectl kustomize .
    if (-not $rendered) {
        throw "kustomize no produjo salida"
    }
    Write-Host "OK kubectl kustomize ($($rendered.Length) lineas)"
    Write-Host "Nota: apply dry-run contra API server omitido (sin clúster local)."
}
finally {
    Pop-Location
}
