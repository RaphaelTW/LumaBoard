"use client";

import {
  CalendarDays,
  ChevronRight,
  CircleGauge,
  CloudSun,
  Code2,
  Copy,
  Focus,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { CHANGELOG } from "./changelog-data";
import type { View } from "./modules";
import { APP_VERSION } from "./pwa-manager";
import { PublicDataPanel } from "./public-data-panel";
import { PublicExplorer, type ManualLocationInput } from "./public-explorer";
import type { PublicSummary } from "./public-data";
import { DEFAULT_PUBLIC_PLUGIN_IDS } from "./public-data";
import type { useLocalWidgets } from "./local-widgets";

const plugins = [
  {
    name: "Agenda",
    description: "Compromissos do dia e próximos eventos.",
    icon: CalendarDays,
    tone: "cyan",
  },
  {
    name: "Tempo",
    description: "Previsão local com atualização inteligente.",
    icon: CloudSun,
    tone: "amber",
  },
  {
    name: "Foco",
    description: "Blocos de concentração e tarefas essenciais.",
    icon: Focus,
    tone: "cyan",
  },
  {
    name: "Dados públicos",
    description: "Economia, ambiente, conteúdo e consultas públicas sem chave.",
    icon: Code2,
    tone: "moss",
  },
];

function formatPublicDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function OverviewModule({
  preview,
  refreshing,
  weatherStatus,
  deviceState,
  calendarTile,
  localWidgets,
  publicSummary,
  publicDataStatus,
  enabledPublicPlugins,
  onCreateScreen,
  onCreateDisplayLink,
  onOpenPreview,
  onRefreshDevice,
  onRefreshPublicData,
  onUseLocation,
  onUseMachineLocation,
  onToast,
  onNavigate,
}: {
  preview: ReactNode;
  refreshing: boolean;
  weatherStatus: "loading" | "ready" | "stale" | "error";
  deviceState: { name: string; synced: string };
  calendarTile: { day: string; month: string };
  localWidgets: ReturnType<typeof useLocalWidgets>;
  publicSummary: PublicSummary;
  publicDataStatus: "loading" | "ready" | "stale" | "error";
  enabledPublicPlugins: string[];
  onCreateScreen: () => void;
  onCreateDisplayLink: () => void;
  onOpenPreview: () => void;
  onRefreshDevice: () => void;
  onRefreshPublicData: () => void;
  onUseLocation: (input: ManualLocationInput) => Promise<boolean>;
  onUseMachineLocation: () => void;
  onToast: (message: string) => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <div>
      <section className="page-heading">
        <div>
          <span className="eyebrow">CENTRAL AMBIENTE</span>
          <h1>Seu ambiente, em sintonia.</h1>
          <p>
            Conteúdo útil, silencioso e sempre no lugar certo — sem depender
            de nuvem, licença por tela ou distrações.
          </p>
        </div>
        <div className="heading-actions">
          <button className="button primary" onClick={onCreateScreen}>
            <Plus /> Criar tela
          </button>
          <button className="button secondary" onClick={onCreateDisplayLink}>
            <Copy /> Gerar link do display
          </button>
        </div>
      </section>

      <button className="release-summary panel" onClick={() => onNavigate("experience")} aria-label="Abrir changelog completo">
        <span className="release-version">v{APP_VERSION}</span>
        <span><strong>{CHANGELOG[0]?.title ?? "Atualização recente"}</strong><small>{CHANGELOG[0]?.highlights[0] ?? "Consulte as novidades desta versão."}</small></span>
        <ChevronRight aria-hidden="true" />
      </button>

      <section className="overview-grid">
        <article className="preview-panel panel">
          <header className="panel-heading">
            <div>
              <span className="status-dot" />
              <strong>Pré-visualização ao vivo</strong>
            </div>
            <div className="preview-meta mono">
              E-PAPER 5:3 <span>800 × 480</span>
              <button className="icon-button compact" onClick={onOpenPreview} aria-label="Ampliar prévia">
                <Maximize2 />
              </button>
            </div>
          </header>
          <button className="preview-button" onClick={onOpenPreview} aria-label="Abrir prévia em tela ampliada">
            {preview}
          </button>
          <footer className="preview-footer">
            <span>
              <RefreshCw className={refreshing ? "spin" : ""} />
              {refreshing ? "Atualizando…" : `Atualizado ${deviceState.synced}`}
            </span>
            <span>{weatherStatus === "ready" ? "Clima ao vivo" : weatherStatus === "stale" ? "Clima em cache" : "Conectando ao clima"} · 4 cinzas</span>
          </footer>
        </article>

        <div className="status-column">
          <article className="device-card panel">
            <header>
              <span className="device-icon"><Monitor /></span>
              <div>
                <strong>{deviceState.name}</strong>
                <span><span className="status-dot" /> navegador local</span>
              </div>
              <MoreHorizontal />
            </header>
            <div className="device-metrics">
              <div><CalendarDays /><strong>{localWidgets.events.length}</strong><span>eventos locais</span></div>
              <div><CloudSun /><strong>{enabledPublicPlugins.length}</strong><span>fontes públicas visíveis</span></div>
            </div>
            <button className="button primary full" onClick={onRefreshDevice} disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} />
              {refreshing ? "Atualizando…" : "Atualizar tudo"}
            </button>
          </article>

          <article className="schedule-card panel">
            <header>
              <div>
                <span className="eyebrow">PRÓXIMO COMPROMISSO</span>
                <strong>{localWidgets.nextEvent?.title ?? "Agenda livre"}</strong>
              </div>
              <span className="date-tile mono">{calendarTile.day}<small>{calendarTile.month}</small></span>
            </header>
            <div className="schedule-time">
              <strong className="mono">{localWidgets.nextEvent?.time ?? "--:--"}</strong>
              <span>{localWidgets.nextEvent ? formatPublicDate(localWidgets.nextEvent.occurrenceDate) : "Adicione um evento abaixo"}</span>
            </div>
            <div className="progress"><i /></div>
            <button className="text-button" onClick={() => document.querySelector(".local-data-section")?.scrollIntoView({ behavior: "smooth" })}>Editar agenda local <ChevronRight /></button>
          </article>
        </div>
      </section>

      <PublicDataPanel
        summary={publicSummary}
        status={publicDataStatus}
        onRefresh={onRefreshPublicData}
        enabled={enabledPublicPlugins}
      />

      <PublicExplorer
        onUseLocation={onUseLocation}
        onUseMachineLocation={onUseMachineLocation}
        onToast={onToast}
      />

      <section className="metric-grid" aria-label="Resumo operacional">
        <article className="metric panel"><span className="metric-icon"><Monitor /></span><div><strong>1</strong><span>display local</span><small>link compartilhável, sem pareamento</small></div></article>
        <article className="metric panel"><span className="metric-icon"><CloudSun /></span><div><strong>{enabledPublicPlugins.length}</strong><span>fontes opcionais visíveis</span><small>{DEFAULT_PUBLIC_PLUGIN_IDS.length} disponíveis sem chave</small></div></article>
        <article className="metric panel"><span className="metric-icon"><CircleGauge /></span><div><strong>0</strong><span>contas obrigatórias</span><small>nenhum token armazenado</small></div></article>
        <article className="insight panel"><span className="metric-icon"><Sparkles /></span><div><strong>Backend sem estado</strong><span>A Function apenas normaliza dados públicos; agenda, foco e preferências ficam no localStorage.</span></div></article>
      </section>

      <section className="plugins-section">
        <header className="section-heading">
          <div><span className="eyebrow">BIBLIOTECA</span><h2>Plugins em destaque</h2></div>
          <button className="text-button" onClick={() => onNavigate("library")}>Ver todos <ChevronRight /></button>
        </header>
        <div className="plugins-grid">
          {plugins.map(({ name, description, icon: Icon, tone }) => (
            <article className="plugin-card panel" key={name}>
              <header>
                <span className={`plugin-icon ${tone}`}><Icon /></span>
                <span className="status-chip"><span className="status-dot" /> ATIVO</span>
              </header>
              <h3>{name}</h3>
              <p>{description}</p>
              <button className="text-button" onClick={() => onNavigate("library")}>Configurar <SlidersHorizontal /></button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
