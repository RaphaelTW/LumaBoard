"use client";

import { createWidget, type DashboardLayout } from "./dashboard-config";

export type TemplateCategory = "casa" | "produtividade" | "informacao" | "entretenimento" | "especial";
export type TemplateDevice = "celular" | "tablet" | "desktop" | "tv" | "e-paper";

export type DashboardTemplate = {
  id: string;
  name: string;
  description: string;
  audience: string;
  category: TemplateCategory;
  device: TemplateDevice;
  tags: string[];
  featured?: boolean;
  themeId: string;
  palette: [string, string, string];
  createLayout: () => DashboardLayout;
};

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function layout(name: string, columns: 1 | 2 | 3 | 4, background: DashboardLayout["background"], widgets: DashboardLayout["widgets"], gap = 14): DashboardLayout {
  return { id: id("layout"), name, columns, gap, background, widgets };
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  { id: "home", name: "Painel doméstico", description: "Clima, agenda, relógio, notícias e música para a rotina da casa.", audience: "Casa", category: "casa", device: "tablet", tags: ["família", "rotina", "clima"], featured: true, themeId: "paper", palette: ["#f2efe7", "#35513a", "#fbfaf6"], createLayout: () => layout("Painel doméstico", 3, "paper", [createWidget("clock"), createWidget("weather"), createWidget("agenda", { rowSpan: 2 }), createWidget("news", { colSpan: 2, rowSpan: 2 }), createWidget("music")]) },
  { id: "work", name: "Painel de trabalho", description: "Foco, tarefas, agenda, economia e notícias de tecnologia.", audience: "Produtividade", category: "produtividade", device: "desktop", tags: ["trabalho", "foco", "agenda"], featured: true, themeId: "paper", palette: ["#fbfaf6", "#35513a", "#e7e1d5"], createLayout: () => layout("Painel de trabalho", 3, "paper", [createWidget("focus", { rowSpan: 2 }), createWidget("agenda", { rowSpan: 2 }), createWidget("economy"), createWidget("news", { colSpan: 2, rowSpan: 2 })]) },
  { id: "news", name: "Central de notícias", description: "Tecnologia, anime, economia e relógio em destaque.", audience: "Informação", category: "informacao", device: "desktop", tags: ["notícias", "economia", "tecnologia"], featured: true, themeId: "night", palette: ["#080d14", "#6ee7f2", "#101925"], createLayout: () => layout("Central de notícias", 4, "night", [createWidget("clock"), createWidget("weather"), createWidget("economy"), createWidget("agenda"), createWidget("news", { colSpan: 2, rowSpan: 2 }), createWidget("anime", { colSpan: 2, rowSpan: 2 })]) },
  { id: "anime", name: "Painel anime", description: "Notícias, lançamentos, música e horário local.", audience: "Entretenimento", category: "entretenimento", device: "tablet", tags: ["anime", "música", "lançamentos"], featured: true, themeId: "lavender", palette: ["#f5f3ff", "#8b5cf6", "#faf5ff"], createLayout: () => layout("Painel anime", 3, "night", [createWidget("anime", { colSpan: 2, rowSpan: 2 }), createWidget("music", { rowSpan: 2 }), createWidget("clock"), createWidget("weather")]) },
  { id: "radio", name: "Rádio e música", description: "Reprodução musical, rádios, relógio e clima.", audience: "Áudio", category: "entretenimento", device: "desktop", tags: ["rádio", "música", "áudio"], themeId: "oled", palette: ["#000000", "#7df9ff", "#080808"], createLayout: () => layout("Rádio e música", 3, "night", [createWidget("music", { colSpan: 2, rowSpan: 3 }), createWidget("clock"), createWidget("weather"), createWidget("agenda")]) },
  { id: "desk-clock", name: "Relógio de mesa", description: "Relógio grande com clima e próximo compromisso.", audience: "Mesa", category: "especial", device: "tablet", tags: ["relógio", "mesa", "minimalista"], themeId: "oled", palette: ["#000000", "#7df9ff", "#ffffff"], createLayout: () => layout("Relógio de mesa", 2, "night", [createWidget("clock", { colSpan: 2, rowSpan: 2, fontScale: 1.5 }), createWidget("weather"), createWidget("agenda")], 18) },
  { id: "eink", name: "Painel e-paper", description: "Alto contraste e poucos widgets para telas de baixa atualização.", audience: "E-paper", category: "especial", device: "e-paper", tags: ["e-paper", "baixo consumo", "contraste"], featured: true, themeId: "eink", palette: ["#eceae1", "#111111", "#f7f5ed"], createLayout: () => layout("Painel e-paper", 3, "eink", [createWidget("clock"), createWidget("weather"), createWidget("agenda", { rowSpan: 2 }), createWidget("focus"), createWidget("economy")], 10) },
  { id: "tv", name: "Painel para televisão", description: "Cartões amplos e carrosséis para visualização à distância.", audience: "TV", category: "especial", device: "tv", tags: ["televisão", "sala", "distância"], featured: true, themeId: "ocean", palette: ["#020617", "#22d3ee", "#082f49"], createLayout: () => layout("Painel para televisão", 4, "night", [createWidget("clock", { colSpan: 2 }), createWidget("weather", { colSpan: 2 }), createWidget("news", { colSpan: 2, rowSpan: 2, fontScale: 1.2 }), createWidget("anime", { colSpan: 2, rowSpan: 2, fontScale: 1.2 })], 20) },
  { id: "kids", name: "Rotina infantil", description: "Relógio, tarefas, clima e foco em formato simples.", audience: "Família", category: "casa", device: "tablet", tags: ["crianças", "tarefas", "rotina"], themeId: "sunset", palette: ["#2b1020", "#fb7185", "#fff1f2"], createLayout: () => layout("Rotina infantil", 2, "paper", [createWidget("clock"), createWidget("weather"), createWidget("agenda", { colSpan: 2, rowSpan: 2, fontScale: 1.2 }), createWidget("focus", { colSpan: 2 })], 18) },
  { id: "study", name: "Painel de estudos", description: "Pomodoro, agenda de provas, notícias e música ambiente.", audience: "Estudos", category: "produtividade", device: "desktop", tags: ["estudos", "pomodoro", "provas"], featured: true, themeId: "forest", palette: ["#0f1f14", "#84cc16", "#19351f"], createLayout: () => layout("Painel de estudos", 3, "paper", [createWidget("focus", { rowSpan: 2 }), createWidget("agenda", { rowSpan: 2 }), createWidget("music", { rowSpan: 2 }), createWidget("news", { colSpan: 3, rowSpan: 2 })]) },
  { id: "morning", name: "Bom dia", description: "Visão rápida para começar o dia com hora, clima e agenda.", audience: "Rotina", category: "casa", device: "celular", tags: ["manhã", "agenda", "rápido"], themeId: "paper", palette: ["#f2efe7", "#35513a", "#fbfaf6"], createLayout: () => layout("Bom dia", 2, "paper", [createWidget("clock", { colSpan: 2 }), createWidget("weather"), createWidget("agenda")], 12) },
  { id: "executive", name: "Resumo executivo", description: "Economia, agenda e notícias em uma composição objetiva.", audience: "Negócios", category: "produtividade", device: "desktop", tags: ["executivo", "economia", "agenda"], themeId: "ocean", palette: ["#020617", "#22d3ee", "#082f49"], createLayout: () => layout("Resumo executivo", 4, "night", [createWidget("clock"), createWidget("economy"), createWidget("weather"), createWidget("agenda"), createWidget("news", { colSpan: 4, rowSpan: 2 })]) },
  { id: "minimal", name: "Minimal", description: "Apenas relógio, clima e agenda com muito espaço visual.", audience: "Minimalismo", category: "especial", device: "tablet", tags: ["minimalista", "calmo", "limpo"], themeId: "lavender", palette: ["#f5f3ff", "#8b5cf6", "#faf5ff"], createLayout: () => layout("Minimal", 2, "transparent", [createWidget("clock", { colSpan: 2, rowSpan: 2, bordered: false, background: "transparent", fontScale: 1.4 }), createWidget("weather", { bordered: false, background: "transparent" }), createWidget("agenda", { bordered: false, background: "transparent" })], 24) },
  { id: "night-shift", name: "Turno noturno", description: "Foco, relógio e agenda com baixo brilho para ambientes escuros.", audience: "Trabalho noturno", category: "produtividade", device: "desktop", tags: ["noturno", "oled", "foco"], themeId: "oled", palette: ["#000000", "#7df9ff", "#080808"], createLayout: () => layout("Turno noturno", 3, "night", [createWidget("clock"), createWidget("focus", { rowSpan: 2 }), createWidget("agenda", { rowSpan: 2 }), createWidget("weather"), createWidget("music", { colSpan: 3 })]) },
  { id: "weekend", name: "Fim de semana", description: "Clima, música, anime e notícias para um painel descontraído.", audience: "Lazer", category: "entretenimento", device: "tv", tags: ["lazer", "fim de semana", "música"], themeId: "sunset", palette: ["#2b1020", "#fb7185", "#431a2b"], createLayout: () => layout("Fim de semana", 4, "night", [createWidget("weather"), createWidget("clock"), createWidget("music", { colSpan: 2 }), createWidget("anime", { colSpan: 2, rowSpan: 2 }), createWidget("news", { colSpan: 2, rowSpan: 2 })], 18) },
  { id: "family-calendar", name: "Agenda da família", description: "Agenda em destaque com clima, relógio e foco nas tarefas da casa.", audience: "Família", category: "casa", device: "tablet", tags: ["família", "calendário", "tarefas"], themeId: "forest", palette: ["#0f1f14", "#84cc16", "#19351f"], createLayout: () => layout("Agenda da família", 3, "paper", [createWidget("agenda", { colSpan: 2, rowSpan: 3, fontScale: 1.15 }), createWidget("clock"), createWidget("weather"), createWidget("focus")]) },
];

export function templateCategories(): TemplateCategory[] {
  return ["casa", "produtividade", "informacao", "entretenimento", "especial"];
}

export function findTemplates(query: string, category: "all" | TemplateCategory, favorites: string[] = []): DashboardTemplate[] {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  return DASHBOARD_TEMPLATES.filter((template) => category === "all" || template.category === category)
    .filter((template) => !normalized || [template.name, template.description, template.audience, ...template.tags].join(" ").toLocaleLowerCase("pt-BR").includes(normalized))
    .sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name, "pt-BR"));
}
