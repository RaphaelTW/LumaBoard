# Security Hardening — v1.8.8

A v1.8.8 reforça fronteiras de confiança sem alterar a arquitetura local-first.

## Fronteiras aplicadas

- entrada de APIs validada, normalizada e limitada;
- rate limit de melhor esforço nas rotas públicas;
- requests de navegador explicitamente cross-site e origens divergentes são recusados;
- consultas e coordenadas não entram em cache compartilhado;
- coordenadas são reduzidas antes de chegar às Functions;
- respostas upstream possuem timeout, redirect bloqueado e limite de bytes/estrutura;
- URLs externas aceitam apenas HTTPS público, sem credenciais e sem hosts locais ou privados; links retornados por provedores conhecidos usam allowlist de domínio;
- imagens externas usam allowlist;
- importações JSON têm limites de tamanho, profundidade, nós e chaves perigosas;
- temas rejeitam SVG em data URL;
- compartilhamento de dashboards possui limite de tamanho e normalização;
- arquivos ICS são limitados e normalizados contra injeção de linhas;
- preferências de consentimento e ciência legal não são importadas por backup;
- service worker não armazena respostas `private` ou `no-store`, limita quantidade, tamanho declarado e tipo de conteúdo dos caches e valida mensagens;
- CSP de produção remove `unsafe-eval`, bloqueia frames, objetos e handlers inline;
- dependências de topo e overrides são fixados exatamente; todas as entradas remotas do lockfile exigem integridade SHA-512 e origem no registro npm;
- scripts de instalação permitidos são declarados explicitamente;
- pacote de release rejeita arquivos sensíveis, artefatos locais e links simbólicos.

## Riscos residuais

A contenção em memória das Functions não é um rate limit distribuído. Para tráfego elevado, use proteção de borda da plataforma. O armazenamento local não é criptografado. Backups exportados devem ser tratados como dados pessoais. O uso de áudio de rádios exige `media-src https:` porque as estações variam de origem. A CSP ainda mantém `unsafe-inline` para scripts e estilos devido à renderização estática atual; uma política por nonce exigirá renderização dinâmica. Consultas GET podem aparecer em logs da plataforma. Domínios arbitrários de rádios permanecem sujeitos a DNS rebinding, embora IPs literais privados e protocolos inseguros sejam bloqueados.

## Rotina recomendada

1. executar `npm ci`;
2. executar `npm run check`;
3. executar `npm run security:full` com internet;
4. revisar alterações do lockfile;
5. gerar o pacote com `npm run release:package`;
6. conferir o SHA-256;
7. testar headers no deploy real do Netlify.
