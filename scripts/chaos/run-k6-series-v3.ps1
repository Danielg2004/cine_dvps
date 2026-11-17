$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

# Refrescar PATH por si k6 se instaló en esta sesión
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  throw "k6 no esta instalado o no esta en PATH"
}

$env:MYSQL_ROOT_PASSWORD = if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { "CineLabLocalOnly2026" }
$env:MYSQL_DATABASE = "cine_dvps"
$env:APP_VERSION = "5.0.0"
$env:APP_TRACK = "caos"
$env:CACHE_URL = ""
$env:CHAOS_FAULT_TOKEN = "token-lab-local-seguimiento4"
$env:ADMISSION_MAX_INFLIGHT = "8"
$env:BULKHEAD_MAX_CONCURRENT = "8"
$env:CINE_BASE_URL = "http://127.0.0.1:3000"
$env:CINE_PELICULA_ID = "1"
# IMPORTANTE: no usar K6_DURATION / K6_VUS / K6_ITERATIONS — k6 las trata como
# opciones globales y anulan el scenario constant-arrival-rate.
Remove-Item Env:K6_DURATION -ErrorAction SilentlyContinue
Remove-Item Env:K6_VUS -ErrorAction SilentlyContinue
Remove-Item Env:K6_ITERATIONS -ErrorAction SilentlyContinue
Remove-Item Env:K6_STAGES -ErrorAction SilentlyContinue
Remove-Item Env:K6_MAX_VUS -ErrorAction SilentlyContinue
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

function Wait-ApiReady {
  for ($i = 1; $i -le 40; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/healthz" -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return }
    } catch {}
    Start-Sleep -Seconds 2
  }
  throw "API no respondio /healthz"
}

function Ensure-Pelicula {
  try {
    Invoke-RestMethod -Uri "$($env:CINE_BASE_URL)/api/v2/peliculas/1" -Method GET -TimeoutSec 5 | Out-Null
    $env:CINE_PELICULA_ID = "1"
    return
  } catch {}
  $created = Invoke-RestMethod -Uri "$($env:CINE_BASE_URL)/api/v2/peliculas" -Method POST -ContentType "application/json" -Body '{"nombre":"Pelicula Sintetica Chaos","duracion":120,"genero":"Drama","descripcion":"Dato sintetico lab docker"}'
  $env:CINE_PELICULA_ID = [string]$created.id
}

function Invoke-JsonPost([string]$url, [string]$jsonPath, [hashtable]$headers) {
  return Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Headers $headers -InFile $jsonPath -UseBasicParsing
}

function Start-SaturationIfNeeded([string]$round) {
  if ($round -eq "baseline") { return }
  $tmp = Join-Path $env:TEMP "cine-sat-start.json"
  @(
    "{"
    "  `"holdMs`": $($env:CHAOS_HOLD_MS),"
    "  `"maxInflight`": $($env:CHAOS_MAX_INFLIGHT),"
    "  `"durationSec`": $($env:CHAOS_DURATION_SEC),"
    "  `"maxQueueWaitMs`": $($env:CHAOS_MAX_QUEUE_WAIT_MS)"
    "}"
  ) | Set-Content -Path $tmp -Encoding ascii
  $headers = @{ "x-chaos-token" = $env:CHAOS_FAULT_TOKEN }
  $resp = Invoke-JsonPost "$($env:CINE_BASE_URL)/api/v3/__test/saturation/start" $tmp $headers
  if ($resp.StatusCode -ne 202) {
    throw "No se activo saturacion: HTTP $($resp.StatusCode)"
  }
}

function Stop-Saturation {
  try {
    Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/api/v3/__test/saturation/stop" -Method POST -ContentType "application/json" -Body "{}" -Headers @{ "x-chaos-token" = $env:CHAOS_FAULT_TOKEN } -UseBasicParsing | Out-Null
  } catch {}
  try {
    Invoke-WebRequest -Uri "$($env:CINE_BASE_URL)/healthz" -UseBasicParsing -TimeoutSec 5 | Out-Null
  } catch {}
}

function Start-Round([string]$round) {
  $env:EXPERIMENT_ROUND = $round
  Write-Host "=== API round=$round ==="
  # force-recreate: EXPERIMENT_ROUND cambia solo por env
  docker compose -p cine-lab-s4 -f docker-compose.yml up -d --build --force-recreate api | Out-Host
  Wait-ApiReady
  Ensure-Pelicula
  Start-SaturationIfNeeded $round
  try {
    Write-Host "=== k6 round=$round rate=$($env:CINE_ARRIVAL_RATE) duration=$($env:CINE_DURATION) ==="
    k6 run load/k6/cine-chaos-profile.js
  }
  finally {
    Stop-Saturation
  }
}

Write-Host "Asegurando MySQL lab..."
docker compose -p cine-lab-s4 -f docker-compose.yml up -d mysql | Out-Host
Start-Sleep -Seconds 3

Start-Round "baseline"
Start-Round "r0"
Start-Round "r1"

Write-Host "=== Comparacion ==="
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json

# Copia evidencia versionada de serie
Copy-Item chaos/results/baseline.json chaos/results/baseline-k6-v3.json -ErrorAction SilentlyContinue
Copy-Item chaos/results/comparison.json chaos/results/comparison-k6-v3.json -Force

Write-Host "Deteniendo API lab..."
docker compose -p cine-lab-s4 stop api | Out-Host
Write-Host "Serie k6 v3 completada."
