"use client";

import { CalendarDays, Columns3, Newspaper, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { AgendaEvent } from "./local-widgets";
import type { DashboardState } from "./dashboard-config";
import type { PublicSummary } from "./public-data";
import type { View } from "./modules";

type NavItem = {
  id: View;
  label: string;
  icon: typeof Search;
};

function formatPublicDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

export function GlobalSearchDialog({
  events,
  summary,
  layouts,
  navItems,
  onNavigate,
  onClose,
}: {
  events: AgendaEvent[];
  summary: PublicSummary;
  layouts: DashboardState["layouts"];
  navItems: NavItem[];
  onNavigate: (view: View) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const navigationResults = navItems.filter((item) => !normalized || item.label.toLocaleLowerCase("pt-BR").includes(normalized));
  const eventResults = events.filter((item) => item.title.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 5);
  const newsResults = [...summary.news, ...summary.anime.news].filter((item) => item.title.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 6);
  const layoutResults = layouts.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 5);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="modal-backdrop global-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="global-search-dialog" role="dialog" aria-modal="true" aria-label="Busca global">
        <header><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar telas, agenda, notícias…" /><kbd>ESC</kbd></header>
        <div className="global-search-results">
          <div><span className="eyebrow">NAVEGAÇÃO</span>{navigationResults.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { onNavigate(id); onClose(); }}><Icon /><strong>{label}</strong><small>Abrir área</small></button>)}</div>
          {eventResults.length > 0 && <div><span className="eyebrow">AGENDA</span>{eventResults.map((item) => <button key={item.id} onClick={() => { onNavigate("overview"); onClose(); window.setTimeout(() => document.querySelector(".local-data-section")?.scrollIntoView({ behavior: "smooth" }), 50); }}><CalendarDays /><strong>{item.title}</strong><small>{formatPublicDate(item.date)} · {item.time}</small></button>)}</div>}
          {layoutResults.length > 0 && <div><span className="eyebrow">LAYOUTS</span>{layoutResults.map((layout) => <button key={layout.id} onClick={() => { onNavigate("studio"); onClose(); }}><Columns3 /><strong>{layout.name}</strong><small>{layout.widgets.length} widgets</small></button>)}</div>}
          {newsResults.length > 0 && <div><span className="eyebrow">NOTÍCIAS</span>{newsResults.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><Newspaper /><strong>{item.title}</strong><small>{item.source}</small></a>)}</div>}
          {normalized && navigationResults.length + eventResults.length + layoutResults.length + newsResults.length === 0 && <p>Nenhum resultado local encontrado.</p>}
        </div>
      </section>
    </div>
  );
}
