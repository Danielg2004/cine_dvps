param(
    [ValidateSet("rollback", "90-10", "75-25", "50-50", "100-canary")]
    [string]$Modo = "rollback"
)

$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$archivo = Join-Path $raiz "docker\canary\nginx.conf"

$pesos = switch ($Modo) {
    "rollback"   { @(1, 0) }
    "90-10"      { @(9, 1) }
    "75-25"      { @(3, 1) }
    "50-50"      { @(1, 1) }
    "100-canary" { @(0, 1) }
}

$stablePeso = $pesos[0]
$canaryPeso = $pesos[1]

$stableLinea = if ($stablePeso -eq 0) {
    "        server cine-api-stable-v1:3000 down;"
} else {
    "        server cine-api-stable-v1:3000 weight=$stablePeso;"
}

$canaryLinea = if ($canaryPeso -eq 0) {
    "        server cine-api-canary-v4:3000 down;"
} else {
    "        server cine-api-canary-v4:3000 weight=$canaryPeso;"
}

$configuracion = @"
events {}

http {
    upstream cine_backend {
$stableLinea
$canaryLinea
    }

    server {
        listen 8080;

        location / {
            proxy_pass http://cine_backend;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        }
    }
}
"@

$anterior = Get-Content $archivo -Raw

try {
    [System.IO.File]::WriteAllText(
        $archivo,
        $configuracion.TrimEnd() + "`n",
        [System.Text.UTF8Encoding]::new($false)
    )

    docker exec cine-nginx-canary nginx -t

    if ($LASTEXITCODE -ne 0) {
        throw "La configuracion NGINX no es valida."
    }

    docker exec cine-nginx-canary nginx -s reload

    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible recargar NGINX."
    }

    Write-Host "Distribucion aplicada: $Modo"
}
catch {
    [System.IO.File]::WriteAllText(
        $archivo,
        $anterior,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "Se restauro el archivo anterior."
    throw
}
