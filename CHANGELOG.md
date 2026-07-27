# Changelog

## [1.8.1] - 2026-07-27

### Privacidade e transparência

- Novas páginas estáticas de Termos de Uso, Aviso de Privacidade e Política de Cookies e Armazenamento Local.
- Banner de escolhas locais com categorias necessárias, preferências e conteúdo externo.
- Publicidade e estatísticas permanecem desativadas; qualquer ativação futura exigirá novo aviso.
- Botão permanente de Privacidade para revisão das escolhas.
- Consentimento versionado no localStorage e incluído no backup local.
- Textos preparados para revisão jurídica antes de monetização.
- Cache PWA e versão instalada atualizados para 1.8.1.


## [1.8.0] - 2026-07-27

### Adicionado

- Oito temas oficiais: Papel, Noturno, OLED, E-paper, Oceano, Floresta, Pôr do sol e Lavanda.
- Controles de densidade, arredondamento, sombras, escala tipográfica e contraste automático.
- Pré-visualização ao vivo do tema antes de aplicá-lo ao restante do painel.
- Duplicação e exclusão segura de temas personalizados, além de restauração dos temas oficiais.
- Exportação de um tema ou de uma coleção completa e importação compatível com os dois formatos.
- Escolha de tema por layout, mantendo um tema global como fallback.
- Galeria com 16 modelos locais, busca textual, filtros por categoria, favoritos e modal de pré-visualização.
- Metadados de público, dispositivo, tags, paleta e destaque para cada modelo.
- Novos modelos: Bom dia, Resumo executivo, Minimal, Turno noturno, Fim de semana e Agenda da família.
- Testes específicos para migração de temas, pacotes, filtros e interface da galeria.

### Alterado

- Estado dos temas migrado automaticamente para a versão 3.
- Variáveis CSS agora controlam cantos, densidade e intensidade das sombras.
- Cache PWA e versão instalada atualizados para 1.8.0.

Todas as mudanças relevantes do LumaBoard são registradas neste arquivo. O projeto usa versionamento semântico.

## [1.7.1] - 2026-07-24

### Corrigido

- A área de conteúdo no desktop agora desconta a largura real da sidebar fixa, eliminando o corte à direita.
- A sidebar passa ao modo compacto em notebooks, janelas menores e cenários com zoom do navegador.
- A Visão geral reorganiza a pré-visualização e os cartões de status quando não há largura suficiente.
- Cabeçalhos, ações e botões podem quebrar linha sem ultrapassar a viewport.
- Containers principais, módulos e pré-visualizações respeitam `min-width: 0` e o limite visual da janela.
- O comportamento móvel validado na v1.7.0 foi preservado sem mudanças na navbar inferior.
- Cache PWA e versão instalada atualizados para 1.7.1.

### Validação

- Testes responsivos cobrem o cálculo da largura útil, a compactação da sidebar e a reorganização em notebooks.

## [1.7.0] - 2026-07-24

### Adicionado

- Visualizações de calendário mensal, semanal, diária e lista dos próximos 90 dias.
- Resumo local de itens abertos hoje, tarefas atrasadas, conclusões recentes e prioridades altas.
- Campos de duração e local, além de até cinco alertas por tarefa ou lembrete.
- Edição somente desta ocorrência, desta e das próximas ou de toda a série recorrente.
- Reagendamento por seletor de data para celulares, além do arrastar e soltar no desktop.
- Duplicação e exclusão de uma única ocorrência sem apagar a série.
- Caixa de entrada local de notificações com estados lido, dispensado e adiado.
- Horário silencioso, adiamento padrão, retenção configurável e notificação de teste.
- Alertas usam o service worker quando disponível; ao tocar, o aplicativo retorna diretamente à agenda.
- Exportação `.ics` enriquecida com duração, local, prioridade, exceções e alarmes.
- Importação `.ics` compatível com `DTEND`, `LOCATION`, `PRIORITY`, `EXDATE` e `VALARM`.
- Testes específicos do sistema de notificações, quatro visualizações e armazenamento v7.

### Alterado

- O sino do cabeçalho passa a mostrar notificações reais da agenda e permite marcar todas como lidas.
- A Central de Notificações separa a caixa de entrada da agenda dos avisos de APIs, PWA e armazenamento.
- O armazenamento local passa para a versão 7 e inclui preferências e histórico de notificações nos backups.
- Cache PWA e versão instalada atualizados para 1.7.0.

### Limitações conhecidas

- Sem servidor de push, os popups do navegador são avaliados somente enquanto o LumaBoard está aberto. O histórico e os adiamentos continuam locais e offline.

## [1.6.4] - 2026-07-24

### Corrigido

- O projeto volta a passar pelas regras atuais do ESLint para React 19 e Next.js 16.
- O editor de temas deixa de espelhar estado derivado dentro de `useEffect`, reduzindo renderizações em cascata.
- O intervalo dos displays passa a editar diretamente o perfil selecionado, sem sincronização redundante por efeito.
- A saída do modo display usa `next/link` para navegação interna.
- Validadores de `localStorage` foram reforçados e avisos de código não utilizado foram removidos.
- O script PowerShell agora interrompe imediatamente quando `npm ci` ou `npm run check` falham e exibe UTF-8 corretamente.
- A limpeza de `node_modules` no Windows agora detecta arquivos bloqueados e informa como corrigir.
- O build de produção deixa de importar o ícone inexistente `Install` do `lucide-react`; a ação de instalação usa ícones compatíveis.
- O verificador remove configurações PostCSS obsoletas deixadas por extrações sobre versões antigas.

### Alterado

- Cache PWA e versão instalada atualizados para 1.6.4.
- Testes de implantação e responsividade sincronizados com a release.

## [1.6.3] - 2026-07-24

### Corrigido

- O sino do cabeçalho agora abre um painel de notificações rápidas, em vez de apenas redirecionar silenciosamente.
- A navbar móvel foi isolada em uma camada própria, com cinco colunas fixas e sem largura herdada da página.
- Safe areas, zoom, orientação e telas de 320 px passam a ser tratados pela própria barra inferior.
- O cache PWA foi renovado para impedir que celulares continuem usando o CSS antigo.
- O Turbopack agora usa explicitamente a pasta do projeto como raiz, mesmo quando existe outro `package-lock.json` na pasta do usuário.
- A dependência Tailwind/PostCSS foi removida porque o projeto utiliza CSS próprio; isso elimina o erro `Can't resolve 'tailwindcss'`.

### Implantação

- O `netlify.toml` usa a detecção automática do adaptador OpenNext, sem forçar `.next` como diretório publicado.
- A proteção contra versões desencontradas do Next.js no Netlify foi habilitada.

## [1.6.2] - 2026-07-24

### Corrigido

- Navegação inferior móvel refeita para cinco posições estáveis, sem depender de zoom manual.
- Acesso aos demais módulos movido para um menu inferior completo e responsivo.
- Cabeçalho móvel protegido contra corte do logotipo, avatar e ações em Android e iPhone.
- Containers principais agora respeitam integralmente a largura visual do aparelho.
- Fundo e tema passam a cobrir toda a viewport, inclusive após alteração de zoom e orientação.
- Cache da PWA atualizado para distribuir imediatamente os estilos corrigidos.

### Alterado

- Versão instalada passa a aparecer na barra lateral, no painel inicial e no menu móvel.
- Painel inicial ganhou um resumo clicável da release atual.
- CSS responsivo foi consolidado para reduzir regras conflitantes e melhorar renderização.
- Testes responsivos agora verificam viewport, navegação fixa, menu completo e versão do cache.

## [1.6.1] - 2026-07-23

### Corrigido

- Cabeçalho móvel reorganizado para impedir corte do avatar, botões e logotipo em telas estreitas.
- Navegação inferior agora inclui todos os módulos em uma faixa horizontal rolável e acessível por toque.
- Margens, safe areas e espaçamentos revisados para Android, iPhone e PWA instalada.
- Cards, formulários, botões e ações deixam de ultrapassar a largura do aparelho.
- Automação de chuva recebeu métricas e botões responsivos, incluindo aparelhos muito estreitos.
- Estúdio, playlists, música, diagnósticos, aparência, modelos e central de notificações passam a usar uma coluna em celulares.
- Agenda mantém a página dentro do viewport e usa rolagem horizontal isolada para as grades mensal e semanal.
- Carrosséis de notícias alternam entre duas colunas e uma coluna conforme a largura disponível.
- Modais usam altura dinâmica e respeitam as áreas seguras do sistema.
- Modo display, tela offline e busca global foram ajustados para alturas e larguras reduzidas.

### Alterado

- Breakpoints foram consolidados para celulares compactos, celulares, tablets, notebooks e desktops ultrawide.
- Alvos de toque e botões principais agora têm dimensões mais confortáveis em telas móveis.
- O cache da PWA foi atualizado para a versão 1.6.1, garantindo a entrega dos novos estilos.

## [1.6.0] - 2026-07-23

### Adicionado

- Service worker próprio, cache do app shell e funcionamento offline das telas principais.
- Tela offline personalizada para layouts, agenda, tarefas e Pomodoro.
- Aviso de nova versão com atualização manual, cópia de segurança antes do recarregamento e recuperação pela área Experiência.
- Restauração da última área aberta e opção de iniciar diretamente no modo display.
- Sincronização automática das APIs públicas quando a conexão retorna.
- Indicadores globais de dados atuais, offline e dados em cache.
- Ícones PWA em 72, 96, 128, 144, 152, 192, 384 e 512 pixels.
- Ícone maskable e splash screens para celulares e tablets.
- Instruções de instalação para Android, Windows, macOS e iPhone/iPad.
- Central local de notificações para tarefas vencidas, compromissos, chuva, falhas de APIs, atualização, áudio e notícias salvas.
- Agenda mensal e semanal com arrastar e soltar ocorrências.
- Edição de uma ocorrência ou de toda a série recorrente.
- Data final de recorrência, dias específicos da semana e lembretes antecipados.
- Subtarefas, prioridades, notas, pesquisa e filtros da agenda.
- Importação e exportação de calendários no formato `.ics`.
- Temas Papel, Noturno, OLED e E-paper.
- Editor de cores, tipografia, escala, gradiente e imagem de fundo local.
- Temas por layout e contraste automático para acessibilidade.
- Importação e exportação de temas.
- Galeria local com dez modelos prontos.
- Validação de backups, limites de tamanho e migração para a versão de armazenamento 6.
- Recuperação de dados corrompidos e registro local de problemas de armazenamento.
- Tratamento global de erros, avisos de armazenamento e monitor básico de desempenho.
- Restauração de configurações sem apagar agenda, tarefas, Pomodoro e favoritos.
- Changelog visível dentro do aplicativo e histórico completo neste arquivo.

### Alterado

- O `localStorage` agora possui limites preventivos por item e validação mais rigorosa.
- A agenda antiga é migrada automaticamente com valores padrão para os novos campos.
- O modo display herda o tema definido para cada layout.
- O Netlify envia o service worker sem cache para detectar novas versões corretamente.

### Segurança e privacidade

- Nenhuma conta, chave de API, banco externo ou armazenamento persistente no servidor foi adicionado.
- As atualizações não são aplicadas automaticamente durante uma sessão ativa.
- Backups importados aceitam apenas chaves conhecidas do LumaBoard.

## [1.5.0] - 2026-07-23

- Editor visual de dashboards, layouts múltiplos e playlists por horário.
- Modo display, compartilhamento por link/QR/JSON e descoberta musical sem autenticação.

## [1.4.0] - 2026-07-23

- Agenda recorrente, notificações locais e carrosséis de tecnologia e anime.

## [1.3.0] - 2026-07-23

- Ampliação das APIs públicas sem chave e consultas sob demanda.

## [1.2.0] - 2026-07-23

- Primeira versão funcional local-first com agenda, Pomodoro e Functions sem estado.
