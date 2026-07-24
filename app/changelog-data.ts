export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  { version: "1.7.0", date: "2026-07-24", title: "Calendar & Notifications", highlights: ["Calendário com visualizações de mês, semana, dia e lista", "Edição de uma ocorrência, desta e das próximas ou de toda a série", "Duração, local, múltiplos alertas e arquivos .ics enriquecidos", "Caixa de entrada local com lidos, histórico, adiamento e dispensa", "Horário silencioso e teste de notificações do navegador", "Resumo de produtividade, filtros e reagendamento otimizado para mobile"] },
  { version: "1.6.4", date: "2026-07-24", title: "Quality Gate & Build Validation", highlights: ["Lint compatível com React 19 e Next.js 16", "Estados derivados refatorados sem efeitos redundantes", "Navegação interna do display corrigida com next/link", "Validadores locais e avisos de código limpos", "Script PowerShell agora falha corretamente e detecta arquivos bloqueados", "Build corrigido para usar ícones compatíveis do lucide-react", "Configurações PostCSS antigas são removidas pelo verificador"] },
  { version: "1.6.3", date: "2026-07-24", title: "Deployment & Mobile Hotfix", highlights: ["Build local e Netlify estabilizado sem dependência do Tailwind", "Raiz do Turbopack fixada no diretório real do projeto", "Sino abre um painel de notificações funcional", "Navbar móvel isolada da página e protegida contra zoom", "Cache PWA renovado para distribuir os estilos corrigidos"] },
  { version: "1.6.2", date: "2026-07-24", title: "Mobile Navigation & Performance", highlights: ["Navegação móvel fixa em cinco posições com menu completo", "Cabeçalho e containers protegidos contra zoom, overflow e cortes", "Versão e resumo da release visíveis no painel", "CSS responsivo consolidado e carregamento visual mais estável", "Testes de viewport, navegação e cache PWA ampliados"] },
  { version: "1.6.1", date: "2026-07-23", title: "Responsive Experience", highlights: ["Cabeçalho compacto e sem cortes em celulares estreitos", "Navegação móvel completa e rolável para todos os módulos", "Grades, formulários, carrosséis, agenda, música e modais adaptados por breakpoint", "Áreas de toque, safe areas e rolagem interna aprimoradas", "Compatibilidade revisada para Android, iPhone, tablets e desktops ultrawide"] },
  { version: "1.6.0", date: "2026-07-23", title: "PWA & Offline Experience", highlights: ["Service worker, telas principais e dados recentes disponíveis offline", "Atualização controlada com backup e recuperação de segurança", "Central de notificações local", "Agenda mensal/semanal, subtarefas, recorrência avançada e .ics", "Editor de temas e dez modelos prontos", "Validação de backups, recuperação de dados e monitor de desempenho"] },
  { version: "1.5.0", date: "2026-07-23", title: "Visual Dashboard Studio", highlights: ["Editor visual e layouts múltiplos", "Playlists por horário e modo display", "Compartilhamento por link, QR e JSON", "Descoberta musical e rádios sem autenticação"] },
  { version: "1.4.0", date: "2026-07-23", title: "Agenda recorrente e anime", highlights: ["Recorrência diária, semanal, mensal e anual", "Carrosséis de tecnologia e anime", "Pesquisa de animes pelo Jikan"] },
  { version: "1.3.0", date: "2026-07-23", title: "Mais dados públicos", highlights: ["Economia, IBGE, terremotos e ambiente", "Livros, Wikipédia, TV e alimentos", "Consultas sob demanda sem chave"] },
  { version: "1.2.0", date: "2026-07-23", title: "Local-first funcional", highlights: ["Agenda e Pomodoro no localStorage", "Dados públicos sem chave", "Netlify Functions sem estado"] },
];
