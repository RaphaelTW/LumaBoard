# Política de segurança do LumaBoard

## Versões com suporte

A versão estável mais recente recebe correções de segurança. Versões antigas podem não receber patches ou atualizações de dependências.

## Como relatar uma vulnerabilidade

Não publique detalhes exploráveis em uma issue pública antes da correção. Use o canal privado de segurança do repositório no GitHub, quando disponível, ou contate o responsável pelo projeto pelo canal indicado no perfil do repositório.

Inclua:

- versão e commit afetados;
- passos mínimos para reproduzir;
- impacto provável;
- navegador e sistema operacional;
- prova de conceito sem dados reais de terceiros.

Não inclua credenciais, dados pessoais, backups reais ou tokens. O projeto não oferece recompensa financeira formal.

## Modelo de segurança

O LumaBoard é local-first e não possui autenticação, banco de dados próprio ou sincronização em nuvem. Dados pessoais e configurações permanecem no armazenamento do navegador, salvo quando o usuário inicia uma chamada a uma API pública ou abre um link externo.

As Functions públicas são sem estado. Elas aplicam validação de entrada, limites de resposta, allowlist de provedores, timeout e contenção de abuso. O rate limit é uma defesa de melhor esforço por instância, não uma garantia global distribuída.

## Limites conhecidos

- qualquer script executado na mesma origem pode acessar `localStorage`;
- a CSP atual ainda permite script e estilo inline para compatibilidade com a renderização estática do Next.js; uma CSP com nonce exigirá arquitetura dinâmica própria;
- extensões do navegador e dispositivos comprometidos ficam fora do modelo de ameaça;
- URLs de consultas GET podem aparecer em logs da plataforma e provedores públicos podem registrar IP e metadados de rede;
- rádios usam origens HTTPS variadas e dependem da política do navegador; DNS rebinding de um domínio de estação não pode ser eliminado apenas no cliente;
- o service worker melhora o modo offline, mas não substitui backup local;
- não há criptografia ponta a ponta nem proteção por senha dos backups exportados.

## Verificação de release

Execute:

```powershell
npm ci
npm run check
npm run security:full
npm run release:package
```

A auditoria do registro npm exige conexão com a internet. A varredura local `security:scan` é executada também pelo gate e pelo empacotador.
