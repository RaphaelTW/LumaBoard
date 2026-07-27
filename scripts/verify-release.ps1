$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

Write-Host "LumaBoard: verificando a pasta do projeto..." -ForegroundColor Cyan
if (-not (Test-Path "package.json")) {
  throw "Execute este script na pasta que contém package.json."
}

$package = Get-Content "package.json" -Raw | ConvertFrom-Json
Write-Host "Versão encontrada: $($package.version)" -ForegroundColor Green

$parentLock = Join-Path (Split-Path $HOME -Parent) "package-lock.json"
$userLock = Join-Path $HOME "package-lock.json"
if (Test-Path $userLock) {
  Write-Warning "Existe outro package-lock.json em $userLock. A v1.8.0 fixa a raiz do Turbopack, mas remova ou renomeie esse arquivo caso ele não pertença a outro projeto."
}

Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue

# ZIPs extraídos sobre versões antigas podem manter arquivos removidos.
Get-ChildItem -Path . -Filter "postcss.config.*" -ErrorAction SilentlyContinue | Remove-Item -Force
if (Test-Path "node_modules") {
  cmd /c "rmdir /s /q node_modules"
  if (Test-Path "node_modules") {
    throw "Não foi possível remover node_modules. Feche npm run dev, VS Code e outros processos Node e tente novamente."
  }
}

Write-Host "Instalando dependências do lockfile..." -ForegroundColor Cyan
npm ci
if ($LASTEXITCODE -ne 0) {
  throw "A instalação das dependências falhou com código $LASTEXITCODE."
}

Write-Host "Executando lint, testes e build..." -ForegroundColor Cyan
npm run check
if ($LASTEXITCODE -ne 0) {
  throw "A validação da release falhou com código $LASTEXITCODE."
}

Write-Host "Validação concluída com sucesso." -ForegroundColor Green
