"use client";

import { createWidget, type DashboardLayout } from "./dashboard-config";

export type DashboardTemplate = {
  id: string;
  name: string;
  description: string;
  audience: string;
  themeId: string;
  createLayout: () => DashboardLayout;
};

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function layout(name: string, columns: 1 | 2 | 3 | 4, background: DashboardLayout["background"], widgets: DashboardLayout["widgets"]): DashboardLayout {
  return { id: id("layout"), name, columns, gap: 14, background, widgets };
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  { id: "home", name: "Painel doméstico", description: "Clima, agenda, relógio, notícias e música para a rotina da casa.", audience: "Casa", themeId: "paper", createLayout: () => layout("Painel doméstico", 3, "paper", [createWidget("clock"), createWidget("weather"), createWidget("agenda", { rowSpan: 2 }), createWidget("news", { colSpan: 2, rowSpan: 2 }), createWidget("music")]) },
  { id: "work", name: "Painel de trabalho", description: "Foco, tarefas, agenda, economia e notícias de tecnologia.", audience: "Produtividade", themeId: "paper", createLayout: () => layout("Painel de trabalho", 3, "paper", [createWidget("focus", { rowSpan: 2 }), createWidget("agenda", { rowSpan: 2 }), createWidget("economy"), createWidget("news", { colSpan: 2, rowSpan: 2 })]) },
  { id: "news", name: "Central de notícias", description: "Tecnologia, anime, economia e relógio em destaque.", audience: "Informação", themeId: "night", createLayout: () => layout("Central de notícias", 4, "night", [createWidget("clock"), createWidget("weather"), createWidget("economy"), createWidget("agenda"), createWidget("news", { colSpan: 2, rowSpan: 2 }), createWidget("anime", { colSpan: 2, rowSpan: 2 })]) },
  { id: "anime", name: "Painel anime", description: "Notícias, lançamentos, música e horário local.", audience: "Entretenimento", themeId: "night", createLayout: () => layout("Painel anime", 3, "night", [createWidget("anime", { colSpan: 2, rowSpan: 2 }), createWidget("music", { rowSpan: 2 }), createWidget("clock"), createWidget("weather")]) },
  { id: "radio", name: "Rádio e música", description: "Reprodução musical, rádios, relógio e clima.", audience: "Áudio", themeId: "oled", createLayout: () => layout("Rádio e música", 3, "night", [createWidget("music", { colSpan: 2, rowSpan: 3 }), createWidget("clock"), createWidget("weather"), createWidget("agenda")]) },
  { id: "desk-clock", name: "Relógio de mesa", description: "Relógio grande com clima e próximo compromisso.", audience: "Mesa", themeId: "oled", createLayout: () => layout("Relógio de mesa", 2, "night", [createWidget("clock", { colSpan: 2, rowSpan: 2, fontScale: 1.5 }), createWidget("weather"), createWidget("agenda")]) },
  { id: "eink", name: "Painel e-paper", description: "Alto contraste e poucos widgets para telas de baixa atualização.", audience: "E-paper", themeId: "eink", createLayout: () => layout("Painel e-paper", 3, "eink", [createWidget("clock"), createWidget("weather"), createWidget("agenda", { rowSpan: 2 }), createWidget("focus"), createWidget("economy")]) },
  { id: "tv", name: "Painel para televisão", description: "Cartões amplos e carrosséis para visualização à distância.", audience: "TV", themeId: "night", createLayout: () => layout("Painel para televisão", 4, "night", [createWidget("clock", { colSpan: 2 }), createWidget("weather", { colSpan: 2 }), createWidget("news", { colSpan: 2, rowSpan: 2, fontScale: 1.2 }), createWidget("anime", { colSpan: 2, rowSpan: 2, fontScale: 1.2 })]) },
  { id: "kids", name: "Rotina infantil", description: "Relógio, tarefas, clima e bloco de foco em formato simples.", audience: "Família", themeId: "paper", createLayout: () => layout("Rotina infantil", 2, "paper", [createWidget("clock"), createWidget("weather"), createWidget("agenda", { colSpan: 2, rowSpan: 2, fontScale: 1.2 }), createWidget("focus", { colSpan: 2 })]) },
  { id: "study", name: "Painel de estudos", description: "Pomodoro, agenda de provas, notícias e música ambiente.", audience: "Estudos", themeId: "paper", createLayout: () => layout("Painel de estudos", 3, "paper", [createWidget("focus", { rowSpan: 2 }), createWidget("agenda", { rowSpan: 2 }), createWidget("music", { rowSpan: 2 }), createWidget("news", { colSpan: 3, rowSpan: 2 })]) },
];
