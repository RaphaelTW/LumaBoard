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

## Commit da v1.7.0

Execute cada comando separadamente:

```powershell
git status
git add -A
git commit -m "feat: release Calendar and Notifications v1.7.0" -m "Expand LumaBoard with month, week, day and list calendar views, occurrence and series editing, richer ICS interoperability, multiple reminders, local notification inbox, snooze controls, quiet hours, notification history, improved mobile calendar layouts, and storage migration v7."
```

## Tag anotada

```powershell
git tag -a v1.7.0 -m "LumaBoard v1.7.0 - Calendar and Notifications"
```

## Push

```powershell
git push origin main
git push origin v1.7.0
```

## Confirmar no GitHub

```powershell
git log -3 --oneline --decorate
git ls-remote --heads origin main
git ls-remote --tags origin "refs/tags/v1.7.0*"
git status
```

Para uma tag anotada, o comando pode mostrar `refs/tags/v1.7.0` e `refs/tags/v1.7.0^{}`. Isso é normal.

## Configuração esperada no Netlify

- **Base directory:** vazio, quando `package.json` está na raiz.
- **Build command:** `npm run build`.
- **Publish directory:** detecção automática do Next.js/OpenNext.
- **Production branch:** `main`.
- **Node.js:** versão definida no `netlify.toml`.

Depois do push, abra **Deploys** no Netlify e confirme que o commit da v1.7.0 aparece. Em uma PWA instalada, feche e abra o aplicativo novamente e use **Atualizar agora** quando o aviso surgir.
