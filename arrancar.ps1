# Arranca AJP Fighter OS completo: base de datos, app y servidor.
# Uso: doble clic en arrancar.bat (o ejecutar este script). Para pararlo, cierra la ventana o pulsa Ctrl+C.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== AJP Fighter OS ===" -ForegroundColor DarkYellow

# 0) Si el puerto 8080 esta ocupado: si es una copia anterior de la app, se para; si es otro programa, se avisa.
$owner = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
if ($owner) {
    $isOurs = $false
    # RawContent is always text (Content can come back as bytes for this JSON type)
    try { $isOurs = (Invoke-WebRequest http://localhost:8080/actuator/health -UseBasicParsing -TimeoutSec 3).RawContent -match '"status"\s*:\s*"UP"' } catch {}
    if ($isOurs) {
        Write-Host "La app ya estaba abierta: la reinicio con la ultima version..." -ForegroundColor Yellow
        Stop-Process -Id $owner -Force
        Start-Sleep -Seconds 2
    } else {
        $name = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
        throw "El puerto 8080 lo esta usando otro programa ($name). Cierralo y vuelve a intentarlo."
    }
}

# 1) Base de datos (MongoDB en Docker)
Write-Host "[1/3] Base de datos..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Abriendo Docker Desktop (puede tardar un minuto)..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    $ok = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 3
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    }
    if (-not $ok) { throw "Docker no ha arrancado. Abre Docker Desktop y vuelve a intentarlo." }
}
docker compose up -d | Out-Null
Write-Host "      MongoDB listo."

# 2) App (se compila para servirla desde el mismo servidor)
Write-Host "[2/3] Preparando la app..." -ForegroundColor Cyan
Push-Location frontend
if (-not (Test-Path node_modules)) { npm install --no-audit --no-fund | Out-Null }
npm run build --silent | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudo compilar la app." }
Pop-Location
Write-Host "      App lista."

# 3) Servidor
Write-Host "[3/3] Arrancando el servidor..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Abre la app en:" -ForegroundColor Green
Write-Host "   En este ordenador:   http://localhost:8080"
$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if ($tailscale) {
    $ts = (& tailscale ip -4 2>$null | Select-Object -First 1)
    $name = $env:COMPUTERNAME.ToLower()
    if ($ts) {
        Write-Host "   Desde el movil (fuera de casa, con Tailscale):  http://$($name):8080   o   http://$($ts):8080" -ForegroundColor Green
    }
}
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' -and $_.IPAddress -notlike '100.*' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|Loopback' } |
    ForEach-Object { Write-Host "   Desde el movil en el wifi de casa:  http://$($_.IPAddress):8080" }
Write-Host ""
Write-Host "(No cierres esta ventana mientras uses la app)" -ForegroundColor DarkGray
Write-Host ""

# Abre el navegador cuando el servidor este listo (en segundo plano, sin bloquear)
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', `
    'for ($i=0; $i -lt 60; $i++) { try { if ((Invoke-WebRequest http://localhost:8080/actuator/health -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { Start-Process http://localhost:8080; break } } catch { Start-Sleep -Seconds 2 } }'

Push-Location backend
mvn -q -B spring-boot:run
Pop-Location
