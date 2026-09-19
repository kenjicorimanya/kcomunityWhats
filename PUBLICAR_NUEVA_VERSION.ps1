[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   GESTOR Y PUBLICADOR AUTOMATICO DE VERSIONES GITHUB    " -ForegroundColor Green
Write-Host "        Repositorio: kenjicorimanya/kcomunityWhats       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$pkgJsonPath = "$PSScriptRoot\package.json"
$currentVer = "1.0.0"
if (Test-Path $pkgJsonPath) {
    $pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
    $currentVer = $pkg.version
}

Write-Host "Versión actual de la app: $currentVer" -ForegroundColor Yellow
$newVer = Read-Host "Introduce la nueva versión (ej: 1.0.1) [Enter para mantener $currentVer]"
if ([string]::IsNullOrWhiteSpace($newVer)) {
    $newVer = $currentVer
}

Write-Host ""
$title = Read-Host "Título de la versión (ej: Kcomunitywhats v$newVer - Nuevas Mejoras)"
if ([string]::IsNullOrWhiteSpace($title)) {
    $title = "Kcomunitywhats v$newVer"
}

Write-Host ""
Write-Host "Escribe las notas de la versión separadas por punto y coma (;):" -ForegroundColor Yellow
Write-Host "Ej: Optimización de memoria; Mayor velocidad en envíos; Corrección de fallos"
$rawNotes = Read-Host "Novedades"
$changelog = @()
if (-not [string]::IsNullOrWhiteSpace($rawNotes)) {
    $changelog = $rawNotes.Split(';') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
} else {
    $changelog = @("Mejoras de rendimiento y estabilidad general.")
}

Write-Host ""
$isMandatoryInput = Read-Host "¿Es una actualización obligatoria para los clientes? (s/N)"
$mandatory = ($isMandatoryInput -eq 's' -or $isMandatoryInput -eq 'S')

# 1. Actualizar package.json
if (Test-Path $pkgJsonPath) {
    $pkg.version = $newVer
    [System.IO.File]::WriteAllText($pkgJsonPath, ($pkg | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "✅ package.json actualizado a la versión $newVer." -ForegroundColor Green
}

# 2. Generar manifiesto local version.json y kcomunitywhats.json
$today = Get-Date -Format "yyyy-MM-dd"
$manifest = [ordered]@{
    version = $newVer
    releaseDate = $today
    title = $title
    mandatory = $mandatory
    changelog = $changelog
    downloadUrl = "https://github.com/kenjicorimanya/kcomunityWhats/releases/download/v$newVer/Kcomunitywhats_Setup.exe"
}

$manifestPath = "$PSScriptRoot\version.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content $manifestPath -Encoding UTF8
Copy-Item $manifestPath "$PSScriptRoot\kcomunitywhats.json" -Force

Write-Host ""
$autoBuild = Read-Host "¿Deseas compilar y subir esta actualización automáticamente a GitHub ahora? (S/n)"
if ($autoBuild -ne 'n' -and $autoBuild -ne 'N') {
    Write-Host ""
    Write-Host "🔨 Paso 1: Compilando instalador (npm run dist)..." -ForegroundColor Cyan
    Set-Location $PSScriptRoot
    & npm run dist

    Write-Host "✍️ Paso 2: Firmando ejecutables con Authenticode..." -ForegroundColor Cyan
    $pkgDir = "$PSScriptRoot\PAQUETE_INSTALACION_CLIENTE"
    $distDir = "$PSScriptRoot\dist"
    Copy-Item "$distDir\Kcomunitywhats Setup 1.0.0.exe" "$pkgDir\Kcomunitywhats_Setup.exe" -Force
    Copy-Item "$distDir\win-unpacked\*" "$pkgDir\Kcomunitywhats_Portable\" -Recurse -Force

    $signScript = "C:\Users\kanak\.gemini\antigravity\brain\36c779c4-46cf-47e5-964b-47a081dd45c3\scratch\sign_only.ps1"
    if (Test-Path $signScript) {
        & powershell -ExecutionPolicy Bypass -File $signScript
    }

    Write-Host "🚀 Paso 3: Subiendo a GitHub Releases de forma automática..." -ForegroundColor Cyan
    & node "$PSScriptRoot\tools\publish-release.js"

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " ¡PROCESO DE ACTUALIZACIÓN COMPLETADO CON ÉXITO!         " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "Operación guardada localmente. Puedes subirla cuando quieras ejecutando SUBIR_A_GITHUB_AUTOMATICO.bat." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Presiona Enter para cerrar"
