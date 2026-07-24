# Changelog

Todas as mudanças relevantes do LumaBoard são registradas neste arquivo. O projeto usa versionamento semântico.

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
