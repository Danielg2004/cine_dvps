param(
    [ValidateSet("normal", "error", "latencia")]
    [string]$Escenario = "normal",

    [int]$Solicitudes = 30,

    [double]$MaxErrores = 5,

    [double]$MaxP95 = 1000
)

$ErrorActionPreference = "Stop"

if ($Solicitudes -lt 10) {
    throw "Se requieren al menos 10 solicitudes."
}

$baseUrl = "http://localhost:3003"

if ($Escenario -ne "normal") {
    if ([string]::IsNullOrWhiteSpace($env:CANARY_FAULT_TOKEN)) {
        throw "Falta CANARY_FAULT_TOKEN en esta sesion."
    }

    $url = "$baseUrl/api/v3/__test/fault?tipo=$Escenario"
    $headers = @{
        "x-canary-test-token" = $env:CANARY_FAULT_TOKEN
    }
}
else {
    $url = "$baseUrl/api/v2/health"
    $headers = @{}
}

$duraciones = @()
$errores = 0

for ($i = 1; $i -le $Solicitudes; $i++) {
    $reloj = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $respuesta = Invoke-WebRequest `
            -Uri $url `
            -Headers $headers `
            -UseBasicParsing `
            -TimeoutSec 10

        if ($respuesta.StatusCode -ge 500) {
            $errores++
        }
    }
    catch {
        $errores++
    }
    finally {
        $reloj.Stop()
        $duraciones += $reloj.Elapsed.TotalMilliseconds
    }
}

$ordenadas = @($duraciones | Sort-Object)
$indiceP95 = [Math]::Ceiling($ordenadas.Count * 0.95) - 1
$p95 = $ordenadas[$indiceP95]
$tasaErrores = ($errores / $Solicitudes) * 100

Write-Host "=============================="
Write-Host "QUALITY GATE CANARY V4"
Write-Host "=============================="
Write-Host "Escenario:" $Escenario
Write-Host "Solicitudes:" $Solicitudes
Write-Host "Errores:" $errores
Write-Host "Tasa errores:" ([Math]::Round($tasaErrores, 2)) "%"
Write-Host "Latencia p95:" ([Math]::Round($p95, 2)) "ms"

if ($tasaErrores -gt $MaxErrores -or $p95 -gt $MaxP95) {
    Write-Host "CALIDAD NO APROBADA. Ejecutando rollback..." -ForegroundColor Red

    & "$PSScriptRoot\canary-traffic.ps1" -Modo rollback

    if ($LASTEXITCODE -ne 0) {
        throw "El comando de rollback fallo."
    }
}
else {
    Write-Host "CALIDAD APROBADA. Canary puede continuar." -ForegroundColor Green
}
