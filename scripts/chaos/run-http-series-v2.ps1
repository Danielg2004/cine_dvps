$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

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
$env:LAB_CONCURRENCY = "20"
$env:LAB_WINDOW_SEC = "6"
$env:CHAOS_HOLD_MS = "250"
$env:CHAOS_MAX_INFLIGHT = "8"
$env:CHAOS_DURATION_SEC = "30"
$env:CHAOS_MAX_QUEUE_WAIT_MS = "200"

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
  $body = Get-Content -Raw "tests\fixtures\pelicula-sintetica.json"
  # quitar id para create limpio si existe
  try {
    Invoke-RestMethod -Uri "$($env:CINE_BASE_URL)/api/v2/peliculas/1" -Method GET -TimeoutSec 5 | Out-Null
    $env:CINE_PELICULA_ID = "1"
    return
  } catch {}
  $created = Invoke-RestMethod -Uri "$($env:CINE_BASE_URL)/api/v2/peliculas" -Method POST -ContentType "application/json" -Body '{"nombre":"Pelicula Sintetica Chaos","duracion":120,"genero":"Drama","descripcion":"Dato sintetico lab docker"}'
  $env:CINE_PELICULA_ID = [string]$created.id
}

function Start-Round([string]$round) {
  $env:EXPERIMENT_ROUND = $round
  Write-Host "=== Levantando API round=$round ==="
  docker compose -p cine-lab-s4 -f docker-compose.yml up -d --build api | Out-Host
  Wait-ApiReady
  Ensure-Pelicula
  Write-Host "=== Midiendo $round ==="
  node scripts/chaos/http-fixed-window-lab.mjs $round
}

Write-Host "Asegurando MySQL lab..."
docker compose -p cine-lab-s4 -f docker-compose.yml up -d mysql | Out-Host
Start-Sleep -Seconds 3

Start-Round "baseline"
Start-Round "r0"
Start-Round "r1"

Write-Host "=== Comparando ==="
node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json

Write-Host "Deteniendo API lab (mysql permanece)..."
docker compose -p cine-lab-s4 stop api | Out-Host
Write-Host "Serie HTTP v2 completada."
