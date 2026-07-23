"use client";

import {
  Activity,
  AlarmClock,
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CloudSun,
  Code2,
  Copy,
  Download,
  Eye,
  Focus,
  Globe2,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Landmark,
  Link,
  MapPin,
  Monitor,
  Mountain,
  MoonStar,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Rss,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Soup,
  Sparkles,
  Sunrise,
  TimerReset,
  Tv,
  Trash2,
  Upload,
  Waves,
  Zap,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  RAIN_RULE_ID,
  type AutomationState,
  type LocalAutomationRule,
  type RainEvaluation,
  clampRainThreshold,
  defaultAutomationState,
  readAutomationState,
  writeAutomationState,
} from "./automation";
import type { WeatherSnapshot } from "./weather";
import { DEFAULT_PUBLIC_PLUGIN_IDS, normalizeEnabledPublicPlugins } from "./public-data";
import {
  exportLocalBackup,
  importLocalBackup,
  migrateBackup,
  safeParseJSON,
  writeStoredValue,
} from "./storage";

export type View =
  | "overview"
  | "studio"
  | "playlists"
  | "devices"
  | "library"
  | "automation"
  | "music"
  | "diagnostics";

type ToastHandler = (message: string) => void;

function ModuleHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="module-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="module-actions">{action}</div>}
    </header>
  );
}

const widgetOptions = [
  { id: "calendar", name: "Agenda", icon: CalendarDays },
  { id: "weather", name: "Tempo", icon: CloudSun },
  { id: "focus", name: "Foco", icon: Focus },
  { id: "text", name: "Texto", icon: BookOpen },
  { id: "image", name: "Imagem", icon: ImageIcon },
  { id: "api", name: "Dados públicos", icon: Code2 },
];

export function LegacyStudioModule({ preview, onToast }: { preview: ReactNode; onToast: ToastHandler }) {
  const [selected, setSelected] = useState("calendar");
  const [layout, setLayout] = useState("thirds");
  const [screenName, setScreenName] = useState("Rotina da manhã");
  const [palette, setPalette] = useState("4-gray");
  const [interval, setInterval] = useState("15");

  useEffect(() => {
    const raw = window.localStorage.getItem("lumaboard-studio");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        selected?: string;
        layout?: string;
        screenName?: string;
        palette?: string;
        interval?: string;
      };
      queueMicrotask(() => {
        if (saved.selected) setSelected(saved.selected);
        if (saved.layout) setLayout(saved.layout);
        if (saved.screenName) setScreenName(saved.screenName);
        if (saved.palette) setPalette(saved.palette);
        if (saved.interval) setInterval(saved.interval);
      });
    } catch {
      // Ignore damaged local drafts and keep the safe defaults.
    }
  }, []);

  const saveDraft = () => {
    const refreshMinutes = Number(interval);
    writeStoredValue("lumaboard-studio", { selected, layout, screenName, palette, interval });
    writeStoredValue("lumaboard-refresh-minutes", refreshMinutes);
    window.dispatchEvent(new CustomEvent("lumaboard:refresh-interval", { detail: refreshMinutes }));
    onToast("Tela e intervalo salvos localmente; o link de display já pode ser copiado.");
  };

  const restoreDraft = () => {
    const saved = safeParseJSON(window.localStorage.getItem("lumaboard-studio"));
    if (!saved || typeof saved !== "object") {
      onToast("Nenhum rascunho local encontrado.");
      return;
    }
    const draft = saved as {
      selected?: string;
      layout?: string;
      screenName?: string;
      palette?: string;
      interval?: string;
    };
    if (draft.selected) setSelected(draft.selected);
    if (draft.layout) setLayout(draft.layout);
    if (draft.screenName) setScreenName(draft.screenName);
    if (draft.palette) setPalette(draft.palette);
    if (draft.interval) setInterval(draft.interval);
    onToast("Rascunho local restaurado.");
  };

  return (
    <section className="module-view studio-view">
      <ModuleHeading
        eyebrow="ESTÚDIO VISUAL"
        title="Crie para qualquer tela."
        description="Configure o rascunho local, veja a prévia em 800 × 480 e compartilhe pelo link de display."
        action={
          <>
            <button className="button secondary" onClick={restoreDraft}><RefreshCw /> Restaurar</button>
            <button className="button secondary" onClick={saveDraft}><Save /> Salvar rascunho</button>
            <button className="button primary" onClick={saveDraft}><Send /> Preparar display</button>
          </>
        }
      />

      <div className="studio-grid">
        <aside className="tool-panel panel">
          <div className="tool-panel-title"><strong>Blocos</strong><button className="icon-button compact" aria-label="Pesquisar blocos"><Search /></button></div>
          <div className="widget-list">
            {widgetOptions.map(({ id, name, icon: Icon }) => (
              <button key={id} className={selected === id ? "active" : ""} onClick={() => setSelected(id)}>
                <span><Icon /></span><strong>{name}</strong><GripVertical />
              </button>
            ))}
          </div>
          <div className="tool-callout">
            <Sparkles /><strong>Dados dinâmicos</strong>
            <span>Combine agenda, clima e as fontes públicas já autorizadas no projeto.</span>
          </div>
        </aside>

        <article className="canvas-panel panel">
          <header className="canvas-toolbar">
            <div className="layout-switcher" aria-label="Escolher layout">
              {[
                ["full", "1"],
                ["halves", "2"],
                ["thirds", "3"],
                ["grid", "4"],
              ].map(([value, label]) => (
                <button key={value} className={layout === value ? "active" : ""} onClick={() => setLayout(value)} aria-label={`Layout com ${label} áreas`}>
                  <LayoutGrid /> {label}
                </button>
              ))}
            </div>
            <div className="canvas-meta mono">800 × 480 · {palette.toUpperCase()}</div>
          </header>
          <div className={`studio-preview layout-${layout}`}>{preview}</div>
          <footer className="canvas-footer">
            <span><Check /> Contraste e-paper aprovado</span>
            <span>Estimativa: 42 KB · 1,8 s</span>
          </footer>
        </article>

        <aside className="inspector-panel panel">
          <div className="tool-panel-title"><strong>Propriedades</strong><Settings2 /></div>
          <label className="control-label" htmlFor="screen-name">Nome da tela</label>
          <input id="screen-name" value={screenName} onChange={(event) => setScreenName(event.target.value)} />

          <label className="control-label" htmlFor="palette">Paleta e-paper</label>
          <select id="palette" value={palette} onChange={(event) => setPalette(event.target.value)}>
            <option value="mono">Preto e branco</option>
            <option value="4-gray">4 níveis de cinza</option>
            <option value="16-gray">16 níveis de cinza</option>
          </select>

          <label className="control-label" htmlFor="interval">Atualização</label>
          <select id="interval" value={interval} onChange={(event) => setInterval(event.target.value)}>
            <option value="5">A cada 5 minutos</option>
            <option value="15">A cada 15 minutos</option>
            <option value="30">A cada 30 minutos</option>
            <option value="60">A cada hora</option>
          </select>

          <div className="inspector-divider" />
          <div className="selected-widget">
            <span className="eyebrow">BLOCO SELECIONADO</span>
            <strong>{widgetOptions.find((item) => item.id === selected)?.name}</strong>
            <small>O rascunho registra o bloco principal, o layout, a paleta e o intervalo usados neste navegador.</small>
          </div>

          <button className="button secondary full" onClick={() => onToast("Prévia atualizada com os dados mais recentes.")}><RefreshCw /> Atualizar prévia</button>
        </aside>
      </div>
    </section>
  );
}

type PlaylistItem = {
  id: number;
  name: string;
  detail: string;
  duration: string;
  enabled: boolean;
  icon: "calendar" | "weather" | "focus" | "news";
};

const createDefaultPlaylist = (city: string): PlaylistItem[] => [
  { id: 1, name: "Agenda de hoje", detail: "Eventos locais · navegador", duration: "15", enabled: true, icon: "calendar" },
  { id: 2, name: "Clima e trajeto", detail: `${city} · 4 cinzas`, duration: "10", enabled: true, icon: "weather" },
  { id: 3, name: "Bloco de foco", detail: "Tarefas locais · monocromático", duration: "25", enabled: true, icon: "focus" },
  { id: 4, name: "Carrossel de notícias", detail: "Tecnologia + anime · abertura externa", duration: "30", enabled: true, icon: "news" },
];

const playlistIcons = { calendar: CalendarDays, weather: CloudSun, focus: Focus, news: Rss };

export function LegacyPlaylistsModule({ onToast, city }: { onToast: ToastHandler; city: string }) {
  const [items, setItems] = useState(() => createDefaultPlaylist(city));
  const [hour, setHour] = useState(14);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("lumaboard-playlist");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as PlaylistItem[];
      if (Array.isArray(saved)) queueMicrotask(() => setItems(saved));
    } catch {
      // Keep defaults.
    }
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem("lumaboard-playlist")) return;
    if (!city || city.includes("…")) return;
    queueMicrotask(() => setItems(createDefaultPlaylist(city)));
  }, [city]);

  const persist = (next: PlaylistItem[]) => {
    setItems(next);
    writeStoredValue("lumaboard-playlist", next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  const activeCount = items.filter((item) => item.enabled).length;
  const rename = (id: number, name: string) => {
    persist(items.map((item) => item.id === id ? { ...item, name } : item));
  };
  const duplicate = (item: PlaylistItem) => {
    persist([...items, { ...item, id: Date.now(), name: `${item.name} cópia` }]);
    onToast("Tela duplicada localmente.");
  };
  const remove = (item: PlaylistItem) => {
    if (!window.confirm(`Excluir "${item.name}" desta playlist?`)) return;
    persist(items.filter((current) => current.id !== item.id));
    onToast("Tela excluída localmente.");
  };

  return (
    <section className="module-view">
      <ModuleHeading
        eyebrow="PROGRAMAÇÃO"
        title="Playlists inteligentes."
        description="Organize a ordem e a duração das telas. A configuração fica salva neste navegador."
        action={<button className="button primary" onClick={() => persist([...items, { id: Date.now(), name: "Nova tela", detail: "Widgets locais", duration: "15", enabled: true, icon: "focus" }])}><Plus /> Adicionar tela</button>}
      />

      <div className="playlist-layout">
        <article className="playlist-panel panel">
          <header className="list-header">
            <div><strong>Trabalho · Dias úteis</strong><span>{activeCount} telas ativas · neste navegador</span></div>
            <div className="list-header-actions"><span className="status-chip"><span className="status-dot" /> SALVA LOCALMENTE</span><button className="icon-button compact" aria-label="Mais opções"><MoreHorizontal /></button></div>
          </header>
          <div className="playlist-list">
            {items.map((item, index) => {
              const Icon = playlistIcons[item.icon as keyof typeof playlistIcons];
              return (
                <article className={!item.enabled ? "disabled" : ""} key={item.id}>
                  <GripVertical className="drag-handle" />
                  <span className="playlist-icon"><Icon /></span>
                  <div className="playlist-copy">
                    {editingId === item.id ? (
                      <input
                        aria-label={`Renomear ${item.name}`}
                        value={item.name}
                        onBlur={() => setEditingId(null)}
                        onChange={(event) => rename(item.id, event.target.value)}
                      />
                    ) : (
                      <button className="text-button" onClick={() => setEditingId(item.id)}><strong>{item.name}</strong></button>
                    )}
                    <span>{item.detail}</span>
                  </div>
                  <label className="duration-field">Duração
                    <select value={item.duration} onChange={(event) => persist(items.map((current) => current.id === item.id ? { ...current, duration: event.target.value } : current))}>
                      <option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="25">25 min</option><option value="30">30 min</option><option value="60">60 min</option>
                    </select>
                  </label>
                  <div className="reorder-buttons">
                    <button className="icon-button compact" aria-label={`Mover ${item.name} para cima`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></button>
                    <button className="icon-button compact" aria-label={`Mover ${item.name} para baixo`} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown /></button>
                  </div>
                  <label className="switch"><input type="checkbox" checked={item.enabled} onChange={(event) => persist(items.map((current) => current.id === item.id ? { ...current, enabled: event.target.checked } : current))} /><span /></label>
                  <button className="icon-button compact" aria-label={`Duplicar ${item.name}`} onClick={() => duplicate(item)}><Copy /></button>
                  <button className="icon-button compact" aria-label={`Excluir ${item.name}`} onClick={() => remove(item)}><Trash2 /></button>
                </article>
              );
            })}
          </div>
          <footer className="list-footer"><button className="text-button" onClick={() => persist([...items, { id: Date.now(), name: "Nova tela", detail: "Sem plugin configurado", duration: "15", enabled: true, icon: "focus" }])}><Plus /> Adicionar à playlist</button><button className="button primary" onClick={() => onToast("Playlist salva neste navegador.")}><Save /> Salvar alterações</button></footer>
        </article>

        <aside className="schedule-sidebar">
          <article className="panel timeline-card">
            <span className="eyebrow">VIAGEM NO TEMPO</span>
            <h3>Simule a programação</h3>
            <p>Veja o que estará na tela sem alterar a agenda real.</p>
            <strong className="simulated-time mono">{String(hour).padStart(2, "0")}:00</strong>
            <input aria-label="Horário da prévia" type="range" min="0" max="23" value={hour} onChange={(event) => setHour(Number(event.target.value))} />
            <div className="time-labels mono"><span>00H</span><span>12H</span><span>23H</span></div>
            <div className="simulation-result"><Clock3 /><div><strong>{hour < 8 ? "Descanso" : hour < 18 ? "Trabalho" : "Casa"}</strong><span>{hour < 8 ? "Tela em pausa" : hour < 18 ? "Agenda de hoje" : "Clima e lembretes"}</span></div></div>
          </article>
          <article className="panel rule-card"><span className="eyebrow">COMPORTAMENTO LOCAL</span><h3>Uso consciente de dados</h3><div className="rule-row"><MoonStar /><div><strong>Janela noturna sugerida</strong><span>Configure o aparelho para reduzir atualizações</span></div><span className="status-chip">GUIA</span></div><div className="rule-row"><TimerReset /><div><strong>Cache de APIs</strong><span>Resumo público reutilizado por até 15 minutos</span></div><span className="status-chip">ATIVO</span></div></article>
        </aside>
      </div>
    </section>
  );
}

type LocalDevice = {
  id: string;
  name: string;
  model: string;
  resolution: string;
  interval: number;
  status: "local";
  sync: string;
};

const devices: LocalDevice[] = [
  { id: "browser", name: "Navegador principal", model: "Navegador", resolution: "800 × 480", interval: 15, status: "local", sync: "salvo neste navegador" },
];

export function DevicesModule({
  preview,
  onToast,
  onDisplay,
  onCopyLink,
}: {
  preview: ReactNode;
  onToast: ToastHandler;
  onDisplay: () => void;
  onCopyLink: () => void;
}) {
  const [localDevices, setLocalDevices] = useState<LocalDevice[]>(devices);
  const [selectedId, setSelectedId] = useState("browser");
  const [refreshMinutes, setRefreshMinutes] = useState(15);
  const selected = localDevices.find((device) => device.id === selectedId) ?? localDevices[0];

  useEffect(() => {
    const saved = safeParseJSON(window.localStorage.getItem("lumaboard-devices"));
    if (Array.isArray(saved) && saved.length > 0) {
      const normalized = saved
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        .map((item, index): LocalDevice => ({
          id: typeof item.id === "string" ? item.id : `local-${index}`,
          name: typeof item.name === "string" ? item.name : "Display local",
          model: typeof item.model === "string" ? item.model : "Navegador",
          resolution: typeof item.resolution === "string" ? item.resolution : "800 × 480",
          interval: typeof item.interval === "number" && Number.isFinite(item.interval) ? item.interval : 15,
          status: "local",
          sync: "salvo neste navegador",
        }));
      if (normalized.length > 0) queueMicrotask(() => setLocalDevices(normalized));
    }
  }, []);

  const persistDevices = (next: LocalDevice[]) => {
    setLocalDevices(next);
    writeStoredValue("lumaboard-devices", next);
  };

  const updateSelected = (patch: Partial<LocalDevice>) => {
    persistDevices(localDevices.map((device) => device.id === selected.id ? { ...device, ...patch } : device));
  };

  useEffect(() => {
    setRefreshMinutes(selected.interval);
  }, [selected.id, selected.interval]);

  return (
    <section className="module-view">
      <ModuleHeading
        eyebrow="DISPLAYS LOCAIS"
        title="Abra em qualquer navegador."
        description="Crie perfis locais ou compartilhe um link. Sem pareamento, conta, token ou banco de dados."
        action={<button className="button primary" onClick={() => { const id = `device-${Date.now()}`; persistDevices([...localDevices, { id, name: "Novo display", model: "Navegador", resolution: "800 × 480", interval: 15, status: "local", sync: "salvo neste navegador" }]); setSelectedId(id); onToast("Perfil de display criado localmente."); }}><Plus /> Novo perfil local</button>}
      />
      <div className="devices-layout">
        <aside className="device-list panel">
          <header><strong>Dispositivos</strong><span>{localDevices.length} perfis locais</span></header>
          {localDevices.map((device) => (
            <button key={device.id} className={selectedId === device.id ? "active" : ""} onClick={() => setSelectedId(device.id)}>
              <span className="device-list-icon"><Monitor /></span>
              <span><strong>{device.name}</strong><small>{device.model} · {device.resolution}</small></span>
              <i className={`status-indicator ${device.status}`} />
            </button>
          ))}
        </aside>

        <div className="device-detail">
          <article className="panel device-hero">
            <header><div><span className="eyebrow">DISPOSITIVO SELECIONADO</span><h2>{selected.name}</h2><p>{selected.model} · {selected.resolution}</p></div><div className="connection-badge local"><Monitor /> local</div></header>
            <div className="device-preview">{preview}</div>
            <footer><span><RefreshCw /> {selected.sync}</span><div><button className="button secondary" onClick={onDisplay}><Eye /> Abrir display</button><button className="button primary" onClick={onCopyLink}><Copy /> Copiar link</button></div></footer>
          </article>

          <div className="device-stat-grid">
            <article className="panel"><Monitor /><strong>Local</strong><span>Armazenamento</span><small>Configuração no navegador</small></article>
            <article className="panel"><Link /><strong>URL</strong><span>Compartilhamento</span><small>Sem servidor de pareamento</small></article>
            <article className="panel"><ShieldCheck /><strong>0</strong><span>Chaves API</span><small>Nenhum segredo necessário</small></article>
          </div>
        </div>

        <aside className="energy-panel panel">
          <span className="eyebrow">ATUALIZAÇÃO</span><h3>Intervalo local</h3><p>Ajuste a frequência usada pelo perfil e reduza chamadas às APIs públicas.</p>
          <div className="battery-projection"><strong>{refreshMinutes}</strong><span>minutos</span></div>
          <label className="control-label" htmlFor="refresh-range">Atualizar a cada {refreshMinutes} min</label>
          <input id="refresh-range" type="range" min="5" max="60" step="5" value={refreshMinutes} onChange={(event) => setRefreshMinutes(Number(event.target.value))} />
          <div className="time-labels mono"><span>5 MIN</span><span>60 MIN</span></div>
          <div className="energy-tip"><Zap /><span>O cache local e o cache da CDN reduzem chamadas repetidas às APIs e à Function.</span></div>
          <button className="button secondary full" onClick={() => { updateSelected({ interval: refreshMinutes }); writeStoredValue("lumaboard-refresh-minutes", refreshMinutes); window.dispatchEvent(new CustomEvent("lumaboard:refresh-interval", { detail: refreshMinutes })); onToast(`Atualização automática definida para ${refreshMinutes} minutos.`); }}><Save /> Aplicar configuração</button>
          <div className="inspector-divider" />
          <label className="control-label" htmlFor="device-name">Nome</label><input id="device-name" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
          <label className="control-label" htmlFor="device-model">Modelo</label><input id="device-model" value={selected.model} onChange={(event) => updateSelected({ model: event.target.value })} />
          <label className="control-label" htmlFor="device-resolution">Resolução</label><input id="device-resolution" value={selected.resolution} onChange={(event) => updateSelected({ resolution: event.target.value })} />
          <button className="button secondary full" onClick={() => { if (localDevices.length <= 1) return; persistDevices(localDevices.filter((device) => device.id !== selected.id)); setSelectedId(localDevices[0].id === selected.id ? localDevices[1].id : localDevices[0].id); }}><Trash2 /> Excluir localmente</button>
        </aside>
      </div>
    </section>
  );
}

const libraryPlugins = [
  { id: "calendar", name: "Agenda local", category: "Produtividade", source: "localStorage", description: "Compromissos criados no navegador, sem Google, Outlook ou login.", icon: CalendarDays, core: true },
  { id: "weather", name: "Clima local", category: "Ambiente", source: "Open-Meteo", description: "Condição atual, previsão e alertas de chuva sem chave de API.", icon: CloudSun, core: true },
  { id: "focus", name: "Foco local", category: "Produtividade", source: "localStorage", description: "Pomodoro persistente, tarefa atual e duração configurável.", icon: Focus, core: true },
  { id: "news", name: "Notícias de tecnologia", category: "Conteúdo", source: "Hacker News + DEV", description: "Carrossel automático com várias histórias, controles e abertura da fonte original.", icon: Rss, core: false },
  { id: "anime", name: "Notícias e animes", category: "Conteúdo", source: "Anime News Network + Jikan", description: "Carrossel de notícias de anime e títulos em exibição, sem conta ou chave.", icon: Sparkles, core: false },
  { id: "air", name: "Qualidade do ar", category: "Ambiente", source: "Open-Meteo / CAMS", description: "AQI europeu e partículas PM2.5 para a localização do display.", icon: Activity, core: false },
  { id: "rates", name: "Câmbio", category: "Economia", source: "Frankfurter", description: "Cotações de dólar e euro em reais, sem autenticação.", icon: Globe2, core: false },
  { id: "holidays", name: "Feriados do Brasil", category: "Produtividade", source: "BrasilAPI", description: "Próximo feriado nacional usando uma API pública brasileira.", icon: CalendarDays, core: false },
  { id: "economy", name: "Selic e IPCA", category: "Economia", source: "Banco Central do Brasil", description: "Taxa Selic anual e IPCA mensal pelas séries temporais oficiais.", icon: Landmark, core: false },
  { id: "ibge", name: "Município e população", category: "Brasil", source: "IBGE", description: "Código oficial, região geográfica e população estimada do município.", icon: MapPin, core: false },
  { id: "earthquakes", name: "Terremotos recentes", category: "Ambiente", source: "USGS", description: "Contagem mundial, maior magnitude e evento mais próximo nas últimas 24 horas.", icon: Activity, core: false },
  { id: "elevation", name: "Altitude", category: "Ambiente", source: "Open-Meteo Elevation", description: "Elevação estimada das coordenadas atuais em metros.", icon: Mountain, core: false },
  { id: "flood", name: "Rios e vazão", category: "Ambiente", source: "Open-Meteo Flood", description: "Vazão modelada do maior rio em uma área próxima às coordenadas.", icon: Activity, core: false },
  { id: "marine", name: "Condição marítima", category: "Ambiente", source: "Open-Meteo Marine", description: "Ondas, temperatura da superfície do mar e corrente em regiões costeiras.", icon: Waves, core: false },
  { id: "sun", name: "Sol e Lua", category: "Ambiente", source: "Sunrise-Sunset.org", description: "Nascer e pôr do sol, duração do dia, fase e iluminação da Lua.", icon: Sunrise, core: false },
  { id: "books", name: "Livro em destaque", category: "Conteúdo", source: "Open Library", description: "Sugestão diária de livro e pesquisa sob demanda por título, autor ou assunto.", icon: BookOpen, core: false },
  { id: "wikipedia", name: "Wikipédia", category: "Conteúdo", source: "Wikimedia", description: "Artigo rotativo e pesquisa de páginas em português.", icon: Globe2, core: false },
  { id: "tv", name: "TV e séries", category: "Conteúdo", source: "TVmaze", description: "Programação brasileira disponível e pesquisa de séries.", icon: Tv, core: false },
  { id: "location-search", name: "Pesquisa de cidades", category: "Ferramentas", source: "Open-Meteo + Nominatim", description: "Encontre uma cidade e aplique suas coordenadas ao painel sem criar conta.", icon: Search, core: true },
  { id: "food-search", name: "Consulta de alimentos", category: "Ferramentas", source: "Open Food Facts", description: "Consulte produto, Nutri-Score e nutrientes usando o código de barras.", icon: Soup, core: true },
];

export function LibraryModule({ onToast }: { onToast: ToastHandler }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [enabled, setEnabled] = useState<string[]>([...DEFAULT_PUBLIC_PLUGIN_IDS]);
  const categories = ["Todos", ...Array.from(new Set(libraryPlugins.map((plugin) => plugin.category)))];

  useEffect(() => {
    const raw = window.localStorage.getItem("lumaboard-plugins");
    if (!raw) return;
    try {
      const saved: unknown = JSON.parse(raw);
      if (Array.isArray(saved)) {
        queueMicrotask(() => setEnabled(normalizeEnabledPublicPlugins(saved)));
      }
    } catch {
      // Keep defaults.
    }
  }, []);

  const filtered = useMemo(() => libraryPlugins.filter((plugin) => {
    const matchesQuery = `${plugin.name} ${plugin.description}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"));
    return matchesQuery && (category === "Todos" || plugin.category === category);
  }), [category, query]);

  const togglePlugin = (id: string) => {
    const next = enabled.includes(id) ? enabled.filter((current) => current !== id) : [...enabled, id];
    setEnabled(next);
    writeStoredValue("lumaboard-plugins", next);
    window.dispatchEvent(new CustomEvent("lumaboard:plugins", { detail: next }));
    onToast(enabled.includes(id) ? "Fonte ocultada do painel." : "Fonte ativada no painel.");
  };

  return (
    <section className="module-view library-view">
      <ModuleHeading eyebrow="ECOSSISTEMA SEM CHAVE" title="Biblioteca de fontes públicas." description="Ative ou oculte fontes selecionadas que funcionam sem conta, OAuth, token ou banco de dados." />

      <div className="library-toolbar panel">
        <label className="search-field"><Search /><input aria-label="Pesquisar plugins" placeholder="Pesquisar agenda, clima, câmbio…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="category-tabs" aria-label="Categorias">
          {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      </div>

      <div className="library-content">
        <div className="library-grid">
          {filtered.map((plugin) => {
            const Icon = plugin.icon;
            const active = plugin.core || enabled.includes(plugin.id);
            return (
              <article className="library-card panel" key={plugin.id}>
                <header><span className="library-icon"><Icon /></span><span className="plugin-category">{plugin.category}</span></header>
                <h3>{plugin.name}</h3><p>{plugin.description}</p>
                <div className="plugin-social"><span>{plugin.source}</span><span>{plugin.core ? "Integrado" : active ? "Visível" : "Oculto"}</span></div>
                <footer><button className="button secondary" disabled={plugin.core} onClick={() => togglePlugin(plugin.id)}>{plugin.core ? <><Check /> Essencial</> : active ? <><Trash2 /> Ocultar</> : <><Plus /> Mostrar</>}</button></footer>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export function AutomationModule({
  onToast,
  weather,
  weatherStatus,
  rainEvaluation,
  onUpdateRainRule,
  onClearRainHistory,
}: {
  onToast: ToastHandler;
  weather: WeatherSnapshot;
  weatherStatus: "loading" | "ready" | "stale" | "error";
  rainEvaluation: RainEvaluation;
  onUpdateRainRule: (rule: LocalAutomationRule) => void;
  onClearRainHistory: () => void;
}) {
  const [state, setState] = useState<AutomationState>(defaultAutomationState);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  const rules = state.rules;
  const rainRule = rules.find((rule) => rule.id === RAIN_RULE_ID) ?? defaultAutomationState.rules[0];

  useEffect(() => {
    const loaded = readAutomationState();
    queueMicrotask(() => setState(loaded));
    queueMicrotask(() =>
      setNotificationPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      ),
    );
  }, []);

  const persistState = (next: AutomationState) => {
    setState(next);
    writeAutomationState(next);
    const nextRainRule = next.rules.find((rule) => rule.id === RAIN_RULE_ID);
    if (nextRainRule) onUpdateRainRule(nextRainRule);
  };

  const exportBackup = () => {
    const payload = exportLocalBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "lumaboard-backup.json"; anchor.click();
    URL.revokeObjectURL(url); onToast("Backup JSON exportado.");
  };

  const importBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const migrated = migrateBackup(JSON.parse(String(reader.result)));
        if (!migrated) throw new Error("invalid");
        importLocalBackup(migrated);
        setState(readAutomationState());
        onToast("Backup restaurado. Recarregue para aplicar todas as preferências.");
      } catch { onToast("Arquivo de backup inválido."); }
    };
    reader.readAsText(file);
  };

  return (
    <section className="module-view">
      <ModuleHeading eyebrow="REGRAS E PRIVACIDADE" title="Automação local-first." description="O alerta de chuva é avaliado no navegador enquanto a página ou PWA estiver aberta, sem fila ou processo em segundo plano." />

      <article className={`panel rain-alert-panel ${rainEvaluation.status === "rain-likely" ? "highlight" : ""}`}>
        <header><div><span className="eyebrow">ALERTA DE CHUVA</span><h3>{rainEvaluation.status === "rain-likely" ? "Chuva provável" : rainEvaluation.status === "no-risk" ? "Sem risco" : rainEvaluation.status === "cached" ? "Dados em cache" : rainEvaluation.status === "disabled" ? "Regra desativada" : "Monitorando"}</h3></div><span className="status-chip">{weatherStatus === "ready" ? "AO VIVO" : weatherStatus === "stale" ? "CACHE" : "INDISPONÍVEL"}</span></header>
        <div className="rain-grid">
          <div><strong>{rainEvaluation.currentProbability ?? "--"}%</strong><span>probabilidade atual</span></div>
          <div><strong>{rainEvaluation.maxProbability ?? "--"}%</strong><span>maior nas próximas 6h</span></div>
          <div><strong>{rainEvaluation.likelyAt ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(rainEvaluation.likelyAt)) : "--"}</strong><span>horário provável</span></div>
        </div>
        <label className="control-label" htmlFor="rain-threshold">Limite: {rainRule.config.threshold}%</label>
        <input id="rain-threshold" type="range" min="10" max="100" value={rainRule.config.threshold} onChange={(event) => persistState({ ...state, rules: rules.map((rule) => rule.id === RAIN_RULE_ID ? { ...rule, trigger: `Chuva > ${event.target.value}%`, config: { threshold: clampRainThreshold(event.target.value) } } : rule) })} />
        <div className="rain-actions">
          <button className="button secondary" onClick={async () => { if (!("Notification" in window)) return; const permission = await Notification.requestPermission(); setNotificationPermission(permission); onToast(permission === "granted" ? "Notificações ativadas." : "Permissão de notificação negada."); }}><Bell /> Ativar notificações</button>
          <button className="button secondary" onClick={onClearRainHistory}><Trash2 /> Limpar histórico</button>
          <span>{notificationPermission === "granted" ? "Notificações permitidas" : notificationPermission === "denied" ? "Notificações negadas" : "Alertas internos ativos"}</span>
        </div>
        <small>{weather.city} · {weather.description} · {rainEvaluation.reason}</small>
      </article>


      <div className="automation-layout">
        <article className="rules-panel panel">
          <header className="list-header"><div><strong>Regra funcional</strong><span>{rainRule.enabled ? "avaliando previsão local" : "desativada"}</span></div></header>
          <div className="rules-list">
            {rules.map((rule) => <article className={rule.id === RAIN_RULE_ID && rainEvaluation.status === "rain-likely" ? "highlight" : ""} key={rule.id}><span className="rule-icon"><Zap /></span><div><strong>{rule.name}</strong><span><AlarmClock /> {rule.trigger}</span><small><ChevronRight /> {rule.action}</small></div><label className="switch"><input type="checkbox" checked={rule.enabled} onChange={(event) => persistState({ ...state, rules: rules.map((current) => current.id === rule.id ? { ...current, enabled: event.target.checked } : current) })} /><span /></label></article>)}
          </div>
        </article>

        <aside className="settings-stack">
          <article className="panel privacy-panel"><span className="privacy-icon"><ShieldCheck /></span><div><span className="eyebrow">PRIVACIDADE</span><h3>Modo sempre local</h3><p>Nenhuma configuração sai deste navegador. Você pode exportar tudo quando quiser.</p></div><span className="status-chip">ATIVO</span></article>
          <article className="panel backup-panel"><span className="eyebrow">PORTABILIDADE</span><h3>Backup e restauração</h3><p>Leve playlists, plugins e regras para outra instalação LumaBoard.</p><div><button className="button secondary" onClick={exportBackup}><Download /> Exportar JSON</button><label className="button secondary upload-button"><Upload /> Importar<input type="file" accept="application/json,.json" onChange={importBackup} /></label></div></article>
          <article className="panel endpoint-panel"><span className="eyebrow">FUNCTION SEM ESTADO</span><h3>Resumo de dados públicos</h3><code className="mono">GET /api/public/summary?lat=&amp;lon=</code><button className="button secondary full" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/api/public/summary`); onToast("Endpoint público copiado."); }}><Copy /> Copiar endpoint</button></article>
          <article className="panel backup-panel"><span className="eyebrow">HISTÓRICO</span><h3>Alertas locais</h3>{state.history.length === 0 ? <p>Nenhum alerta registrado.</p> : state.history.slice(0, 5).map((event) => <p key={event.id}>{event.message}</p>)}</article>
        </aside>
      </div>
    </section>
  );
}

export { StudioModuleV2 as StudioModule, PlaylistsModuleV2 as PlaylistsModule } from "./studio-v2";
