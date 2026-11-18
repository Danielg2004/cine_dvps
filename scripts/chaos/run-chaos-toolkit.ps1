# Ejecutor seguro Chaos Toolkit para Cine S4.
# - dry-run por defecto
# - ejecución real solo con -RealRun y confirmación explícita
# - siempre intenta stop de saturación al final (independiente de CTK)
#
# Uso dry-run:
#   .\scripts\chaos\run-chaos-toolkit.ps1
#
# Uso real (ventana coordinada):
#   $env:CINE_BASE_URL='http://35.239.107.54'
#   $env:CHAOS_FAULT_TOKEN='***'
#   $env:CHAOS_HOLD_MS='200'
#   $env:CHAOS_MAX_INFLIGHT='4'
#   $env:CHAOS_DURATION_SEC='20'
#   .\scripts\chaos\run-chaos-toolkit.ps1 -RealRun -ConfirmSharedWindow

param(
    [switch]$RealRun,
    [switch]$ConfirmSharedWindow,
    [string]$JournalPath = "docs/seguimiento-4/evidencias/chaos-toolkit-journal.json",
    [string]$ChaosBin = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

if (-not $ChaosBin) {
    $candidate = Join-Path $root ".venv-chaos\Scripts\chaos.exe"
    if (Test-Path $candidate) { $ChaosBin = $candidate }
    else { $ChaosBin = "chaos" }
}

$experiment = "chaos/experiments/cine-resource-exhaustion.json"
if (-not (Test-Path $experiment)) { throw "Falta $experiment" }

Write-Host "chaos_bin=$ChaosBin"
Write-Host "experiment=$experiment"
Write-Host "mode=$(if ($RealRun) { 'REAL' } else { 'DRY-RUN' })"

& $ChaosBin validate $experiment
if ($LASTEXITCODE -ne 0) { throw "chaos validate falló" }

function Stop-SaturationManual {
    if (-not $env:CINE_BASE_URL -or -not $env:CHAOS_FAULT_TOKEN) {
        Write-Host "skip_manual_stop: faltan CINE_BASE_URL o CHAOS_FAULT_TOKEN"
        return
    }
    $base = $env:CINE_BASE_URL.TrimEnd('/')
    try {
        Invoke-WebRequest "$base/api/v3/__test/saturation/stop" `
            -Method POST `
            -Headers @{ "x-chaos-token" = $env:CHAOS_FAULT_TOKEN; "Content-Type" = "application/json" } `
            -Body "{}" `
            -UseBasicParsing `
            -TimeoutSec 20 | Out-Null
        $st = Invoke-RestMethod "$base/api/v3/__test/saturation" -Headers @{ "x-chaos-token" = $env:CHAOS_FAULT_TOKEN } -TimeoutSec 15
        Write-Host "manual_stop_active=$($st.active)"
    } catch {
        Write-Host "manual_stop_error=$($_.Exception.Message)"
    }
}

if (-not $RealRun) {
    $dryJournal = "docs/seguimiento-4/evidencias/chaos-toolkit-dry-run-journal.json"
    New-Item -ItemType Directory -Force -Path (Split-Path $dryJournal) | Out-Null
    # CTK 1.21+: --dry requiere estrategia (probes|actions|activities|pause)
    & $ChaosBin run $experiment --dry activities --journal-path $dryJournal --rollback-strategy always
    if ($LASTEXITCODE -ne 0) { throw "chaos dry-run falló" }
    Write-Host "dry_run_ok journal=$dryJournal"
    Write-Host "REAL_RUN_BLOCKED_UNTIL_COORDINATION"
    exit 0
}

if (-not $ConfirmSharedWindow) {
    throw "Ejecución real bloqueada: falta -ConfirmSharedWindow (Sports/Hotel no deben usar Cine)."
}
if (-not $env:CINE_BASE_URL) { throw "CINE_BASE_URL requerido" }
if (-not $env:CHAOS_FAULT_TOKEN -or $env:CHAOS_FAULT_TOKEN.Length -lt 16) {
    throw "CHAOS_FAULT_TOKEN requerido (>=16)"
}

# Intensidad alineada a R0/R1 GKE v2 si no viene del entorno
if (-not $env:CHAOS_DURATION_SEC) { $env:CHAOS_DURATION_SEC = "90" }
if (-not $env:CHAOS_HOLD_MS) { $env:CHAOS_HOLD_MS = "250" }
if (-not $env:CHAOS_MAX_INFLIGHT) { $env:CHAOS_MAX_INFLIGHT = "8" }
if (-not $env:CHAOS_MAX_QUEUE_WAIT_MS) { $env:CHAOS_MAX_QUEUE_WAIT_MS = "200" }

New-Item -ItemType Directory -Force -Path (Split-Path $JournalPath) | Out-Null
$started = (Get-Date).ToUniversalTime().ToString("o")
Write-Host "real_run_start_utc=$started"

try {
    # always: ejecutar rollbacks también si falla hipótesis o hay interrupción
    & $ChaosBin run $experiment --journal-path $JournalPath --rollback-strategy always
    $code = $LASTEXITCODE
} finally {
    Stop-SaturationManual
    $ended = (Get-Date).ToUniversalTime().ToString("o")
    Write-Host "real_run_end_utc=$ended"
}

if ($code -ne 0) { exit $code }
Write-Host "real_run_ok journal=$JournalPath"
exit 0
