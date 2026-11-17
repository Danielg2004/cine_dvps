# Genera kubeconfig temporal con access token (sin gke-gcloud-auth-plugin).
# No imprime el token. Uso: . .\scripts\gcp-kubectl-token.ps1
$ErrorActionPreference = "Stop"
Remove-Item Env:CLOUDSDK_PYTHON -ErrorAction SilentlyContinue

$endpoint = gcloud container clusters describe cine-caos-autopilot --region=us-central1 --project=cine-devops-canary --format="value(endpoint)"
$ca = gcloud container clusters describe cine-caos-autopilot --region=us-central1 --project=cine-devops-canary --format="value(masterAuth.clusterCaCertificate)"
$tokenFile = Join-Path $env:TEMP "cine-gke-token.txt"
$caFile = Join-Path $env:TEMP "cine-gke-ca.crt"
$kube = Join-Path $env:TEMP "cine-gke-kubeconfig.yaml"

gcloud auth print-access-token | Set-Content -Path $tokenFile -NoNewline
[IO.File]::WriteAllBytes($caFile, [Convert]::FromBase64String($ca))

@"
apiVersion: v1
kind: Config
clusters:
- name: cine-caos-autopilot
  cluster:
    server: https://$endpoint
    certificate-authority: $(($caFile -replace '\\','/'))
contexts:
- name: cine-caos-autopilot
  context:
    cluster: cine-caos-autopilot
    user: cine-token-user
current-context: cine-caos-autopilot
users:
- name: cine-token-user
  user:
    tokenFile: $(($tokenFile -replace '\\','/'))
"@ | Set-Content -Path $kube -Encoding ascii

$env:KUBECONFIG = $kube
Write-Host "KUBECONFIG=$kube (token refreshed, not printed)"
