# Aplica OTEL Cine → collector OCI de Samuel.
# Uso:
#   $env:OTEL_LAB_TOKEN = '<token>'   # no commitear
#   .\scripts\gcp-apply-otel-oci.ps1 -CaPath 'C:\ruta\otel-lab-ca.crt'
#
# No imprime token ni Authorization.
param(
  [Parameter(Mandatory = $true)]
  [string]$CaPath,
  [string]$Token = $env:OTEL_LAB_TOKEN,
  [string]$User = "otel-lab",
  [string]$Endpoint = "https://157.137.233.183:31443",
  [string]$Namespace = "cine-caos"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Remove-Item Env:CLOUDSDK_PYTHON -ErrorAction SilentlyContinue

if (-not $Token -or $Token.Trim().Length -lt 8) {
  throw "Falta token. Define OTEL_LAB_TOKEN o pasa -Token por canal privado (no lo pegues en Git)."
}
if (-not (Test-Path -LiteralPath $CaPath)) {
  throw "No existe CA: $CaPath"
}

# Validar PEM mínimo sin volcar contenido
$caRaw = Get-Content -LiteralPath $CaPath -Raw
if ($caRaw -notmatch 'BEGIN CERTIFICATE') {
  throw "El archivo CA no parece PEM (falta BEGIN CERTIFICATE)"
}

Write-Host "=== Precheck TLS con CA (sin auth) ==="
$caAbs = (Resolve-Path -LiteralPath $CaPath).Path
$tlsOk = $false
try {
  $probe = curl.exe -sS --max-time 20 --cacert $caAbs -o NUL -w "%{http_code}" "$Endpoint/"
  Write-Host "TLS GET / => HTTP $probe (esperado 404/401/405 con cadena confiable)"
  $tlsOk = $true
} catch {
  Write-Host "WARN TLS probe: $_"
}
if (-not $tlsOk) {
  throw "TLS con CA falló; no se aplica configuración OTEL"
}

. (Join-Path $PSScriptRoot "gcp-kubectl-token.ps1")

Write-Host "=== Rollback snapshot (imagen/replicas) ==="
$prevImage = kubectl -n $Namespace get deploy cine-api -o jsonpath="{.spec.template.spec.containers[0].image}"
$prevReplicas = kubectl -n $Namespace get deploy cine-api -o jsonpath="{.spec.replicas}"
Write-Host "prev image=$prevImage replicas=$prevReplicas"

Write-Host "=== ConfigMap CA cine-otel-ca ==="
kubectl -n $Namespace create configmap cine-otel-ca `
  --from-file=otel-lab-ca.crt=$caAbs `
  --dry-run=client -o yaml | kubectl apply -f - | Out-Host

Write-Host "=== Secret cine-otel-secrets (headers Basic; valor no impreso) ==="
$bytes = [Text.Encoding]::ASCII.GetBytes("${User}:$Token")
$b64 = [Convert]::ToBase64String($bytes)
$headersValue = "Authorization=Basic%20$b64"
# Crear secret vía archivo temporal y borrarlo
$tmpSecret = Join-Path $env:TEMP ("cine-otel-secret-" + [guid]::NewGuid().ToString("N") + ".yaml")
@"
apiVersion: v1
kind: Secret
metadata:
  name: cine-otel-secrets
  namespace: $Namespace
type: Opaque
stringData:
  OTEL_EXPORTER_OTLP_HEADERS: "$headersValue"
"@ | Set-Content -Path $tmpSecret -Encoding ascii
try {
  kubectl apply -f $tmpSecret | Out-Host
}
finally {
  Remove-Item -LiteralPath $tmpSecret -Force -ErrorAction SilentlyContinue
  $headersValue = $null
  $b64 = $null
  $Token = $null
  Remove-Item Env:OTEL_LAB_TOKEN -ErrorAction SilentlyContinue
}

Write-Host "=== Apply ConfigMap + Deployment (manifiestos repo) ==="
kubectl apply -f (Join-Path $root "deploy\gcp\k8s\configmap.yaml") | Out-Host
kubectl apply -f (Join-Path $root "deploy\gcp\k8s\deployment.yaml") | Out-Host

Write-Host "=== Rollout ==="
kubectl -n $Namespace rollout status deployment/cine-api --timeout=300s | Out-Host
$ready = kubectl -n $Namespace get deploy cine-api -o jsonpath="{.status.readyReplicas}"
$desired = kubectl -n $Namespace get deploy cine-api -o jsonpath="{.spec.replicas}"
if ($ready -ne $desired) {
  Write-Host "Rollout incompleto; revirtiendo imagen a $prevImage"
  kubectl -n $Namespace set image deployment/cine-api cine-api=$prevImage | Out-Host
  kubectl -n $Namespace scale deployment/cine-api --replicas=$prevReplicas | Out-Host
  kubectl -n $Namespace rollout status deployment/cine-api --timeout=300s | Out-Host
  throw "Rollout OTEL falló"
}

Write-Host "=== HTTP checks ==="
$base = if ($env:CINE_PUBLIC_URL) { $env:CINE_PUBLIC_URL.TrimEnd('/') } else { "http://35.239.107.54" }
foreach ($u in @('/healthz', '/readyz', '/api/v2/peliculas/1')) {
  $h = @{}
  if ($u -like '*peliculas*') {
    $h = @{ Accept = 'application/json'; 'x-trace-id' = "otel-smoke-$(Get-Random)"; 'traceparent' = '00-11111111111111111111111111111111-2222222222222222-01' }
  }
  $r = Invoke-WebRequest "$base$u" -Headers $h -UseBasicParsing -TimeoutSec 20
  Write-Host "$u $($r.StatusCode)"
}

Write-Host "=== Boot OTEL (sin secretos) ==="
kubectl -n $Namespace logs deploy/cine-api -c cine-api --tail=80 |
  Select-String -Pattern 'OpenTelemetry iniciado|OTLP|certificate|exporter|ECONN|UNABLE_TO|self.signed|401|403' |
  Select-Object -First 40 |
  ForEach-Object { $_.Line }

Write-Host "=== Generar tráfico para export ==="
1..15 | ForEach-Object {
  Invoke-WebRequest "$base/api/v2/peliculas/1" -Headers @{
    Accept = 'application/json'
    'x-trace-id' = "otel-export-$_"
    'traceparent' = "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01"
  } -UseBasicParsing -TimeoutSec 15 | Out-Null
}
Start-Sleep -Seconds 25
Write-Host "=== Logs post-export (filtrados) ==="
kubectl -n $Namespace logs deploy/cine-api -c cine-api --tail=120 |
  Select-String -Pattern 'OpenTelemetry|OTLP|exporter|ECONN|UNABLE_TO|self.signed|401|403|Failed' |
  Select-Object -First 50 |
  ForEach-Object { $_.Line }

Write-Host "LISTO: revisar Tempo/Prometheus con Samuel (service.name=cine-api)."
Write-Host "Confirma recepción de traces/metrics antes de declarar integración completa."
