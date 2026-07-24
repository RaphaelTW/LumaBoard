export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  { version: "1.6.0", date: "2026-07-23", title: "PWA & Offline Experience", highlights: ["Service worker, telas principais e dados recentes disponíveis offline", "Atualização controlada com backup e recuperação de segurança", "Central de notificações local", "Agenda mensal/semanal, subtarefas, recorrência avançada e .ics", "Editor de temas e dez modelos prontos", "Validação de backups, recuperação de dados e monitor de desempenho"] },
  { version: "1.5.0", date: "2026-07-23", title: "Visual Dashboard Studio", highlights: ["Editor visual e layouts múltiplos", "Playlists por horário e modo display", "Compartilhamento por link, QR e JSON", "Descoberta musical e rádios sem autenticação"] },
  { version: "1.4.0", date: "2026-07-23", title: "Agenda recorrente e anime", highlights: ["Recorrência diária, semanal, mensal e anual", "Carrosséis de tecnologia e anime", "Pesquisa de animes pelo Jikan"] },
  { version: "1.3.0", date: "2026-07-23", title: "Mais dados públicos", highlights: ["Economia, IBGE, terremotos e ambiente", "Livros, Wikipédia, TV e alimentos", "Consultas sob demanda sem chave"] },
  { version: "1.2.0", date: "2026-07-23", title: "Local-first funcional", highlights: ["Agenda e Pomodoro no localStorage", "Dados públicos sem chave", "Netlify Functions sem estado"] },
];
