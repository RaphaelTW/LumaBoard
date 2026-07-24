# Publicação no Windows e Netlify

## O erro `Can't resolve 'tailwindcss'`

Na v1.6.2, o Next.js encontrou outro `package-lock.json` na pasta do usuário e inferiu a raiz do workspace acima da pasta real do LumaBoard. Com isso, a resolução do CSS procurou `tailwindcss` no local errado.

A v1.6.4 corrige o problema de duas formas:

1. fixa `turbopack.root` e `outputFileTracingRoot` na pasta do próprio `next.config.ts`;
2. remove Tailwind/PostCSS, que não eram necessários porque o projeto utiliza CSS próprio.

O comando de commit do PowerShell não causa esse erro. `npm run dev` e `npm run build` são etapas separadas do `git push`.

## Validar antes de publicar

Abra o PowerShell na pasta que contém `package.json` e execute:

```powershell
Set-Location "C:\caminho\para\LumaBoard"
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\verify-release.ps1
```

Ou manualmente:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm ci
npm run check
```

## Commit, tag e push

```powershell
git status
git add -A
git commit -m "fix: release quality gate and build validation v1.6.4" -m "Fix the mobile navbar, make the notification bell functional, stabilize the Next.js workspace root, remove unused Tailwind tooling, simplify Netlify OpenNext deployment, and refresh the PWA cache."
git tag -a v1.6.4 -m "LumaBoard v1.6.4 - Quality Gate and Build Validation"
git push origin main --follow-tags
```

## Confirmar que o GitHub recebeu a versão

```powershell
git log -1 --oneline
git tag --list v1.6.4
git ls-remote --heads origin main
git ls-remote --tags origin v1.6.4
```

O Netlify só inicia um novo deploy quando o commit chega à branch conectada, normalmente `main`.

## Configuração esperada no Netlify

- Base directory: vazio, quando `package.json` está na raiz do repositório.
- Build command: `npm run build`.
- Publish directory: deixar a detecção automática do Next.js/OpenNext.
- Production branch: `main`.
- Node.js: `22.13.0` ou superior compatível.

Depois do push, abra **Deploys** no Netlify e confirme que o commit da v1.6.4 aparece. Em uma PWA já instalada, use o aviso **Atualizar agora** ou feche e abra novamente o aplicativo para receber o novo service worker.
