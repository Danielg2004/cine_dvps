$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

Remove-Item Env:CLOUDSDK_PYTHON -ErrorAction SilentlyContinue
Remove-Item Env:K6_DURATION -ErrorAction SilentlyContinue
Remove-Item Env:K6_VUS -ErrorAction SilentlyContinue
Remove-Item Env:K6_ITERATIONS -ErrorAction SilentlyContinue
Remove-Item Env:K6_STAGES -ErrorAction SilentlyContinue
Remove-Item Env:K6_MAX_VUS -ErrorAction SilentlyContinue

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) { throw "k6 no esta en PATH" }

. (Join-Path $PSScriptRoot "..\gcp-kubectl-token.ps1")

$publicUrl = if ($env:CINE_PUBLIC_URL) { $env:CINE_PUBLIC_URL } else { "http://35.239.107.54" }
$env:CINE_BASE_URL = $publicUrl.TrimEnd('/')
$env:CINE_PELICULA_ID = if ($env:CINE_PELICULA_ID) { $env:CINE_PELICULA_ID } else { "1" }
$env:CINE_ARRIVAL_RATE = if ($env:CINE_ARRIVAL_RATE) { $env:CINE_ARRIVAL_RATE } else { "80" }
$env:CINE_DURATION = if ($env:CINE_DURATION) { $env:CINE_DURATION } else { "30s" }
$env:CINE_PRE_VUS = "40"
$env:CINE_MAX_VUS = "120"
$env:K6_RESULTS_DIR = "chaos/results"
$env:CHAOS_HOLD_MS = "250"
$env:CHAOS_MAX_INFLIGHT = "8"
$env:CHAOS_DURATION_SEC = "90"
$env:CHAOS_MAX_QUEUE_WAIT_MS = "200"

New-Item -ItemType Directory -Force -Path "chaos\results" | Out-Null
New-Item -ItemType Directory -Force -Path "docs\seguimiento-4\evidencias" | Out-Null

$chaosToken = ((gcloud secrets versions access latest --secret=canary-fault-token --project=cine-devops-canary) -replace '[\r\n]', '').Trim()
if (-not $chaosToken -or $chaosToken.Length -lt 16) { throw "CHAOS token invalido" }

function Refresh-Kube {
  . (Join-Path $root "scripts\gcp-kubectl-token.ps1")
}

function Set-ExperimentRound([string]$round) {
  Refresh-Kube
  $resilience = if ($round -eq 'r1') { 'true' } else { 'false' }
  Write-Host "=== ConfigMap EXPERIMENT_ROUND=$round RESILIENCE_ENABLED=$resilience ==="
  $patchFile = Join-Path $env:TEMP "cine-cm-patch.json"
  Set-Content -Path $patchFile -Value (@'
{"data":{"EXPERIMENT_ROUND":"ROUND_PLACEHOLDER","RESILIENCE_ENABLED":"RES_PLACEHOLDER"}}
'@).Replace('ROUND_PLACEHOLDER',$round).Replace('RES_PLACEHOLDER',$resilience) -Encoding ascii
  kubectl -n cine-caos patch configmap cine-api-config --type merge --patch-file $patchFile | Out-Host
  kubectl -n cine-caos rollout restart deployment/cine-api | Out-Host
  kubectl -n cine-caos rollout status deployment/cine-api --timeout=300s | Out-Host
  for ($i = 1; $i -le 40; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/readyz" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { return }
    } catch {}
    Start-Sleep -Seconds 3
  }
  throw "readyz no disponible tras round=$round"
}

function Set-Replicas([int]$n) {
  Refresh-Kube
  Write-Host "=== scale cine-api to $n ==="
  kubectl -n cine-caos scale deployment/cine-api --replicas=$n | Out-Host
  kubectl -n cine-caos rollout status deployment/cine-api --timeout=300s | Out-Host
  for ($i = 1; $i -le 40; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/readyz" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { return }
    } catch {}
    Start-Sleep -Seconds 3
  }
  throw "readyz no disponible tras scale=$n"
}

function Invoke-SaturationHttp([string]$action) {
  # Con 1 réplica, el LB apunta al único pod → satura el proceso in-process completo.
  $headers = @{ "x-chaos-token" = $chaosToken }
  if ($action -eq 'start') {
    $tmp = Join-Path $env:TEMP "cine-sat-body.json"
    @(
      "{"
      "  `"holdMs`": $($env:CHAOS_HOLD_MS),"
      "  `"maxInflight`": $($env:CHAOS_MAX_INFLIGHT),"
      "  `"durationSec`": $($env:CHAOS_DURATION_SEC),"
      "  `"maxQueueWaitMs`": $($env:CHAOS_MAX_QUEUE_WAIT_MS)"
      "}"
    ) | Set-Content -Path $tmp -Encoding ascii
    $resp = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/api/v3/__test/saturation/start" -Method POST -ContentType "application/json" -Headers $headers -InFile $tmp -UseBasicParsing -TimeoutSec 30
    Write-Host "saturation start HTTP=$($resp.StatusCode)"
    if ($resp.StatusCode -ne 202) { throw "start saturacion fallo" }
  } else {
    $resp = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/api/v3/__test/saturation/stop" -Method POST -ContentType "application/json" -Headers $headers -Body "{}" -UseBasicParsing -TimeoutSec 30
    Write-Host "saturation stop HTTP=$($resp.StatusCode)"
  }
}

function Save-PodSnapshot([string]$label) {
  Refresh-Kube
  $out = "chaos/results/gke-pods-$label.txt"
  kubectl -n cine-caos get pods,deploy,svc -o wide 2>&1 | Out-File -FilePath $out -Encoding utf8
}

function Invoke-Round([string]$round) {
  $env:EXPERIMENT_ROUND = $round
  Set-ExperimentRound $round
  Save-PodSnapshot "pre-$round"
  if ($round -ne 'baseline') {
    Invoke-SaturationHttp 'start'
  }
  try {
    Write-Host "=== k6 GKE round=$round rate=$($env:CINE_ARRIVAL_RATE) duration=$($env:CINE_DURATION) url=$($env:CINE_BASE_URL) ==="
    k6 run load/k6/cine-chaos-profile.js
  }
  finally {
    if ($round -ne 'baseline') {
      try { Invoke-SaturationHttp 'stop' } catch { Write-Host "WARN stop: $_" }
    }
    Start-Sleep -Seconds 2
    $hz = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/healthz" -UseBasicParsing -TimeoutSec 15
    $rz = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/readyz" -UseBasicParsing -TimeoutSec 15
    $p = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/api/v2/peliculas/1" -Headers @{Accept='application/json';'x-trace-id'="recovery-$round"} -UseBasicParsing -TimeoutSec 15
    Write-Host "recovery round=$round healthz=$($hz.StatusCode) readyz=$($rz.StatusCode) peliculas=$($p.StatusCode)"
    Save-PodSnapshot "post-$round"
  }

  $src = Get-Content "chaos/results/$round.json" -Raw | ConvertFrom-Json
  $src | Add-Member -NotePropertyName series -NotePropertyValue 'gke-k6-constant-arrival-rate' -Force
  $src | Add-Member -NotePropertyName environment -NotePropertyValue 'gke-autopilot-cine-caos' -Force
  $src | Add-Member -NotePropertyName public_url -NotePropertyValue $env:CINE_BASE_URL -Force
  $src | Add-Member -NotePropertyName replicas_during_experiment -NotePropertyValue 1 -Force
  $src | Add-Member -NotePropertyName note -NotePropertyValue '1 replica durante medicion para aplicar saturacion in-process de forma comparable; cluster vuelve a 2' -Force
  $json = $src | ConvertTo-Json -Depth 10
  Set-Content "chaos/results/$round-k6-gke.json" -Value $json -Encoding utf8
  Set-Content "docs/seguimiento-4/evidencias/$round-k6-gke.json" -Value $json -Encoding utf8
  Set-Content "chaos/results/$round.json" -Value $json -Encoding utf8
}

$pre = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/readyz" -UseBasicParsing -TimeoutSec 15
if ($pre.StatusCode -ne 200) { throw "API publica no ready" }

# Escala a 1 para mediciones comparables (saturacion in-process); se restaura a 2 al final.
Set-Replicas 1

Invoke-Round 'baseline'
Invoke-Round 'r0'
Invoke-Round 'r1'

Write-Host "=== Comparacion GKE ==="
$env:COMPARE_OUT = "chaos/results/comparison-k6-gke.json"
node scripts/chaos/compare-rounds.mjs chaos/results/r0-k6-gke.json chaos/results/r1-k6-gke.json
Copy-Item chaos/results/comparison-k6-gke.json docs/seguimiento-4/evidencias/comparison-k6-gke.json -Force

Set-Replicas 2
Set-ExperimentRound 'baseline'
Remove-Variable chaosToken -ErrorAction SilentlyContinue
Write-Host "Serie k6 GKE completada; replicas restauradas a 2."
