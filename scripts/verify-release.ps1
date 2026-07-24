$ErrorActionPreference = "Stop"

Write-Host "LumaBoard: verificando a pasta do projeto..." -ForegroundColor Cyan
if (-not (Test-Path "package.json")) {
  throw "Execute este script na pasta que contém package.json."
}

$package = Get-Content "package.json" -Raw | ConvertFrom-Json
Write-Host "Versão encontrada: $($package.version)" -ForegroundColor Green

$parentLock = Join-Path (Split-Path $HOME -Parent) "package-lock.json"
$userLock = Join-Path $HOME "package-lock.json"
if (Test-Path $userLock) {
  Write-Warning "Existe outro package-lock.json em $userLock. A v1.6.3 fixa a raiz do Turbopack, mas remova ou renomeie esse arquivo caso ele não pertença a outro projeto."
}

Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Instalando dependências do lockfile..." -ForegroundColor Cyan
npm ci

Write-Host "Executando lint, testes e build..." -ForegroundColor Cyan
npm run check

Write-Host "Validação concluída." -ForegroundColor Green
