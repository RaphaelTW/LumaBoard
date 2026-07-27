# Publicação no Windows e Netlify

## Requisitos

- Node.js 22 LTS ou versão compatível com o Next.js usado pelo projeto.
- Git configurado com acesso ao repositório.
- Projeto aberto na pasta que contém `package.json`.
- Branch de produção do Netlify configurada como `main`.

O LumaBoard fixa `turbopack.root` e `outputFileTracingRoot` na pasta real do projeto. Isso evita que outros arquivos `package-lock.json` existentes na conta do Windows alterem a raiz do Next.js.

## Validar antes de publicar

Abra o PowerShell na pasta do projeto:

```powershell
Set-Location "C:\caminho\para\LumaBoard"
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\verify-release.ps1
```

O script remove artefatos antigos, instala exatamente o lockfile e executa:

```text
ESLint → Vitest → Next.js production build
```

Também é possível executar manualmente:

```powershell
taskkill /F /IM node.exe /T 2>$null
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
cmd /c "rmdir /s /q node_modules"
npm cache verify
npm ci
npm run check
```

Não continue para o commit quando algum comando terminar com erro.

## Commit da v1.8.0

```powershell
git add -A
git commit -m "feat: release Themes and Template Gallery v1.8.0" -m "Add eight official themes, advanced density and surface controls, theme collections, per-layout identities, a searchable gallery with sixteen local templates, favorites, previews, responsive presentation, migration to theme state v3, regression tests, documentation, and refreshed PWA cache."
```

## Tag e push

```powershell
git tag -a v1.8.0 -m "LumaBoard v1.8.0 - Themes and Template Gallery"
git push origin main
git push origin v1.8.0
```

## Conferência

```powershell
git log -3 --oneline --decorate
git ls-remote --heads origin main
git ls-remote --tags origin "refs/tags/v1.8.0*"
git status
```

Depois do push, abra **Deploys** no Netlify e confirme o commit da v1.8.0. Em uma PWA instalada, feche e abra o aplicativo novamente e use **Atualizar agora** quando o aviso surgir.
