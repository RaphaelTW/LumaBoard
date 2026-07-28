# Protocolo de dispositivos do LumaBoard v1.8.8

O LumaBoard funciona como uma PWA local-first. Não há conta, pareamento em nuvem, banco de dados, servidor de sincronização ou canal real entre dispositivos. Cada navegador mantém seu próprio `localStorage`, Cache Storage e permissões.

## Registro local

Dispositivos cadastrados no módulo de dispositivos são registros locais salvos no navegador. Eles ajudam a organizar perfis como TV, desktop, tablet, celular, e-paper ou Raspberry Pi, mas não criam conexão remota. Em outro navegador ou aparelho, o cadastro precisa ser recriado, importado por backup JSON ou recebido por link de configuração quando aplicável.

## Modo display

O modo `/display` lê layouts, playlists, tema e preferências do armazenamento local. Ele pode usar tela cheia, Wake Lock quando disponível, rotação de layouts, pausa, anterior/próximo e cursor oculto. A URL compartilhável pode carregar uma configuração embutida no hash, por exemplo:

```text
https://seu-site.netlify.app/display#config=BASE64URL
```

Esse link transporta dados no próprio endereço. Ele não busca uma configuração privada em servidor.

## Playlists, layouts e temas

Layouts, widgets, playlists, temas oficiais, temas personalizados e favoritos de templates ficam no navegador. Exportação e importação manual são os mecanismos seguros para mover configurações entre aparelhos. Não altere nomes de chaves de `localStorage` sem migração, pois isso pode isolar dados antigos do usuário.

## Conteúdo externo e privacidade

Clima, notícias, música, anime, arte, livros, TV, geocodificação e pesquisas públicas são conteúdo externo opcional. Quando a preferência Conteúdo externo está desativada, o app não inicia novas chamadas opcionais e usa somente recursos locais ou cache já salvo quando existir. A reativação restaura o carregamento sem apagar dados.

Chamadas iniciadas manualmente, como pesquisar uma cidade ou atualizar música, mostram mensagem clara caso o consentimento esteja desativado. Recursos locais como agenda, Pomodoro, layouts, temas, backups, templates locais, páginas legais e modo display continuam funcionando.

## PWA, cache e atualização

O service worker guarda páginas e assets necessários para melhorar o uso offline. O cache da versão 1.8.8 substitui caches antigos do LumaBoard durante a ativação. Páginas legais e telas principais devem permanecer disponíveis quando já armazenadas, mas respostas de APIs externas podem expirar, falhar ou ficar ausentes conforme conexão e consentimento.

Quando uma nova versão do service worker é instalada, o app exibe aviso de atualização e pode limpar caches de runtime sem apagar dados pessoais do `localStorage`.

## Limitações por tipo de tela

- TV e modo display: ideal para visualização contínua; depende do navegador manter a aba/PWA ativa.
- Desktop: edição completa de layouts, biblioteca, backups e diagnóstico.
- Tablet e celular: experiência responsiva com navegação móvel e os mesmos dados locais da origem.
- E-paper/e-reader/Raspberry Pi: recomendado com layouts simples, menos animação e atualização controlada.

## Migração entre dispositivos

Use backup JSON, exportação de layout/tema ou link de display para transportar dados. Como não há backend, não existe conflito automático, merge entre navegadores ou restauração remota. O usuário deve escolher qual arquivo importar e manter cópias quando os dados forem importantes.
