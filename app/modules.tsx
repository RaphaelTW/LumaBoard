"use client";

import {
  Activity,
  AlarmClock,
  ArrowDown,
  ArrowUp,
  BatteryMedium,
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
  Link,
  MapPin,
  Monitor,
  MoonStar,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  Rss,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Trash2,
  Upload,
  Webhook,
  Wifi,
  Zap,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

export type View =
  | "overview"
  | "studio"
  | "playlists"
  | "devices"
  | "library"
  | "automation";

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
  { id: "api", name: "API / JSON", icon: Code2 },
];

export function StudioModule({ preview, onToast }: { preview: ReactNode; onToast: ToastHandler }) {
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
    window.localStorage.setItem(
      "lumaboard-studio",
      JSON.stringify({ selected, layout, screenName, palette, interval }),
    );
    onToast("Tela salva localmente e pronta para sincronizar.");
  };

  return (
    <section className="module-view studio-view">
      <ModuleHeading
        eyebrow="ESTÚDIO VISUAL"
        title="Crie para qualquer tela."
        description="Monte layouts por blocos, veja o resultado em 800 × 480 e publique sem escrever código."
        action={
          <>
            <button className="button secondary" onClick={saveDraft}><Save /> Salvar rascunho</button>
            <button className="button primary" onClick={() => onToast("Tela enviada para Sala. Atualização em andamento…")}><Send /> Enviar para Sala</button>
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
            <span>Use variáveis, condições e qualquer endpoint JSON.</span>
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
            <label><input type="checkbox" defaultChecked /> Ocultar quando não houver dados</label>
            <label><input type="checkbox" defaultChecked /> Atualização adaptativa</label>
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
  { id: 1, name: "Agenda de hoje", detail: "Google Agenda · Sala", duration: "15", enabled: true, icon: "calendar" },
  { id: 2, name: "Clima e trajeto", detail: `${city} · 4 cinzas`, duration: "10", enabled: true, icon: "weather" },
  { id: 3, name: "Bloco de foco", detail: "Tarefas locais · monocromático", duration: "25", enabled: true, icon: "focus" },
  { id: 4, name: "Resumo de notícias", detail: "RSS selecionado · 5 itens", duration: "30", enabled: false, icon: "news" },
];

const playlistIcons = { calendar: CalendarDays, weather: CloudSun, focus: Focus, news: Rss };

export function PlaylistsModule({ onToast, city }: { onToast: ToastHandler; city: string }) {
  const [items, setItems] = useState(() => createDefaultPlaylist(city));
  const [hour, setHour] = useState(14);

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
    window.localStorage.setItem("lumaboard-playlist", JSON.stringify(next));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  const activeCount = items.filter((item) => item.enabled).length;

  return (
    <section className="module-view">
      <ModuleHeading
        eyebrow="PROGRAMAÇÃO"
        title="Playlists inteligentes."
        description="Defina a ordem, a duração e as regras de exibição. O LumaBoard evita renderizações quando os dados não mudam."
        action={<button className="button primary" onClick={() => onToast("Nova tela adicionada à fila.")}><Plus /> Adicionar tela</button>}
      />

      <div className="playlist-layout">
        <article className="playlist-panel panel">
          <header className="list-header">
            <div><strong>Trabalho · Dias úteis</strong><span>{activeCount} telas ativas · Sala</span></div>
            <div className="list-header-actions"><span className="status-chip"><span className="status-dot" /> EM EXECUÇÃO</span><button className="icon-button compact" aria-label="Mais opções"><MoreHorizontal /></button></div>
          </header>
          <div className="playlist-list">
            {items.map((item, index) => {
              const Icon = playlistIcons[item.icon];
              return (
                <article className={!item.enabled ? "disabled" : ""} key={item.id}>
                  <GripVertical className="drag-handle" />
                  <span className="playlist-icon"><Icon /></span>
                  <div className="playlist-copy"><strong>{item.name}</strong><span>{item.detail}</span></div>
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
                </article>
              );
            })}
          </div>
          <footer className="list-footer"><button className="text-button" onClick={() => persist([...items, { id: Date.now(), name: "Nova tela", detail: "Sem plugin configurado", duration: "15", enabled: true, icon: "focus" }])}><Plus /> Adicionar à playlist</button><button className="button primary" onClick={() => onToast("Playlist salva e sincronizada.")}><Save /> Salvar alterações</button></footer>
        </article>

        <aside className="schedule-sidebar">
          <article className="panel timeline-card">
            <span className="eyebrow">VIAGEM NO TEMPO</span>
            <h3>Simule a programação</h3>
            <p>Veja o que estará na tela sem alterar a agenda real.</p>
            <strong className="simulated-time mono">{String(hour).padStart(2, "0")}:00</strong>
            <input aria-label="Horário simulado" type="range" min="0" max="23" value={hour} onChange={(event) => setHour(Number(event.target.value))} />
            <div className="time-labels mono"><span>00H</span><span>12H</span><span>23H</span></div>
            <div className="simulation-result"><Clock3 /><div><strong>{hour < 8 ? "Descanso" : hour < 18 ? "Trabalho" : "Casa"}</strong><span>{hour < 8 ? "Tela em pausa" : hour < 18 ? "Agenda de hoje" : "Clima e lembretes"}</span></div></div>
          </article>
          <article className="panel rule-card"><span className="eyebrow">REGRAS</span><h3>Economia de bateria</h3><div className="rule-row"><MoonStar /><div><strong>Dormir às 22:30</strong><span>Acordar às 07:00</span></div><span className="status-chip">ATIVA</span></div><div className="rule-row"><TimerReset /><div><strong>Ignorar sem mudanças</strong><span>Economia estimada de 18%</span></div><span className="status-chip">ATIVA</span></div></article>
        </aside>
      </div>
    </section>
  );
}

const devices = [
  { id: "sala", name: "Sala", model: "ESP32 · 800 × 480", battery: 82, status: "online", signal: -54, sync: "há 2 min" },
  { id: "cozinha", name: "Cozinha", model: "Kindle · 1072 × 1448", battery: 61, status: "online", signal: -67, sync: "há 8 min" },
  { id: "escritorio", name: "Escritório", model: "Navegador · 1280 × 800", battery: 100, status: "online", signal: -42, sync: "agora" },
  { id: "quarto", name: "Quarto", model: "Kobo · 758 × 1024", battery: 14, status: "offline", signal: 0, sync: "ontem" },
];

export function DevicesModule({
  preview,
  onToast,
  onPair,
  onDisplay,
}: {
  preview: ReactNode;
  onToast: ToastHandler;
  onPair: () => void;
  onDisplay: () => void;
}) {
  const [selectedId, setSelectedId] = useState("sala");
  const [refreshMinutes, setRefreshMinutes] = useState(15);
  const selected = devices.find((device) => device.id === selectedId) ?? devices[0];
  const projectedDays = Math.max(9, Math.round((selected.battery / 100) * (refreshMinutes * 4.8)));

  return (
    <section className="module-view">
      <ModuleHeading
        eyebrow="FROTA BYOD"
        title="Seus displays, uma central."
        description="Conecte hardware próprio, e-readers ou qualquer navegador. Sem taxa por dispositivo."
        action={<button className="button primary" onClick={onPair}><Plus /> Conectar dispositivo</button>}
      />
      <div className="devices-layout">
        <aside className="device-list panel">
          <header><strong>Dispositivos</strong><span>{devices.filter((device) => device.status === "online").length} online</span></header>
          {devices.map((device) => (
            <button key={device.id} className={selectedId === device.id ? "active" : ""} onClick={() => setSelectedId(device.id)}>
              <span className="device-list-icon"><Monitor /></span>
              <span><strong>{device.name}</strong><small>{device.model}</small></span>
              <i className={`status-indicator ${device.status}`} />
            </button>
          ))}
        </aside>

        <div className="device-detail">
          <article className="panel device-hero">
            <header><div><span className="eyebrow">DISPOSITIVO SELECIONADO</span><h2>{selected.name}</h2><p>{selected.model}</p></div><div className={`connection-badge ${selected.status}`}><Wifi /> {selected.status}</div></header>
            <div className="device-preview">{preview}</div>
            <footer><span><RefreshCw /> Sincronizado {selected.sync}</span><div><button className="button secondary" onClick={onDisplay}><Eye /> Abrir display</button><button className="button primary" onClick={() => onToast(`${selected.name} recebeu uma atualização manual.`)}><Send /> Enviar agora</button></div></footer>
          </article>

          <div className="device-stat-grid">
            <article className="panel"><BatteryMedium /><strong>{selected.battery}%</strong><span>Bateria</span><small>{selected.battery < 20 ? "Recarregue em breve" : "Estado saudável"}</small></article>
            <article className="panel"><Wifi /><strong>{selected.status === "online" ? selected.signal : "—"}</strong><span>Sinal Wi-Fi</span><small>{selected.status === "online" ? "Conexão estável" : "Sem conexão"}</small></article>
            <article className="panel"><Activity /><strong>99,8%</strong><span>Disponibilidade</span><small>Últimos 30 dias</small></article>
          </div>
        </div>

        <aside className="energy-panel panel">
          <span className="eyebrow">BATERIA</span><h3>Estimador inteligente</h3><p>Ajuste o intervalo para comparar autonomia e atualidade.</p>
          <div className="battery-projection"><strong>{projectedDays}</strong><span>dias estimados</span></div>
          <label className="control-label" htmlFor="refresh-range">Atualizar a cada {refreshMinutes} min</label>
          <input id="refresh-range" type="range" min="5" max="60" step="5" value={refreshMinutes} onChange={(event) => setRefreshMinutes(Number(event.target.value))} />
          <div className="time-labels mono"><span>5 MIN</span><span>60 MIN</span></div>
          <div className="energy-tip"><Zap /><span>O modo adaptativo ignora atualizações idênticas e pode ampliar a autonomia em até 22%.</span></div>
          <button className="button secondary full" onClick={() => onToast(`Intervalo de ${refreshMinutes} minutos aplicado a ${selected.name}.`)}><Save /> Aplicar configuração</button>
        </aside>
      </div>
    </section>
  );
}

const libraryPlugins = [
  { id: "calendar", name: "Agenda universal", category: "Produtividade", users: "4,8 mil", description: "Google, Outlook, CalDAV e iCal em uma única visualização.", icon: CalendarDays },
  { id: "weather", name: "Clima local", category: "Informação", users: "8,2 mil", description: "Condição atual, previsão e alertas com baixo consumo.", icon: CloudSun },
  { id: "focus", name: "Foco", category: "Produtividade", users: "3,1 mil", description: "Pomodoro, tarefas essenciais e meta do dia.", icon: Focus },
  { id: "rss", name: "RSS limpo", category: "Informação", users: "2,7 mil", description: "Notícias sem anúncios, rastreadores ou distrações.", icon: Rss },
  { id: "webhook", name: "Webhook", category: "Desenvolvimento", users: "1,9 mil", description: "Receba JSON de qualquer serviço e transforme em blocos.", icon: Webhook },
  { id: "home", name: "Casa conectada", category: "Automação", users: "1,5 mil", description: "Sensores, energia e cenas do Home Assistant.", icon: Power },
  { id: "maps", name: "Trajeto", category: "Mobilidade", users: "980", description: "Tempo de viagem, transporte e alertas de saída.", icon: MapPin },
  { id: "custom", name: "Página web", category: "Desenvolvimento", users: "760", description: "Renderize uma URL segura ou endpoint próprio.", icon: Globe2 },
];

export function LibraryModule({ onToast }: { onToast: ToastHandler }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [enabled, setEnabled] = useState<string[]>(["calendar", "weather", "focus"]);
  const [configuring, setConfiguring] = useState<(typeof libraryPlugins)[number] | null>(null);
  const categories = ["Todos", ...Array.from(new Set(libraryPlugins.map((plugin) => plugin.category)))];

  useEffect(() => {
    const raw = window.localStorage.getItem("lumaboard-plugins");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as string[];
      if (Array.isArray(saved)) queueMicrotask(() => setEnabled(saved));
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
    window.localStorage.setItem("lumaboard-plugins", JSON.stringify(next));
    onToast(enabled.includes(id) ? "Plugin removido da sua biblioteca." : "Plugin instalado localmente.");
  };

  return (
    <section className="module-view library-view">
      <ModuleHeading eyebrow="ECOSSISTEMA ABERTO" title="Biblioteca de plugins." description="Conectores prontos e receitas abertas. Seus tokens ficam no seu navegador ou servidor." action={<button className="button primary" onClick={() => onToast("Editor de plugin privado iniciado.")}><Code2 /> Criar plugin</button>} />

      <div className="library-toolbar panel">
        <label className="search-field"><Search /><input aria-label="Pesquisar plugins" placeholder="Pesquisar agenda, clima, webhook…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="category-tabs" aria-label="Categorias">
          {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      </div>

      <div className="library-content">
        <div className="library-grid">
          {filtered.map((plugin) => {
            const Icon = plugin.icon;
            const active = enabled.includes(plugin.id);
            return (
              <article className="library-card panel" key={plugin.id}>
                <header><span className="library-icon"><Icon /></span><span className="plugin-category">{plugin.category}</span></header>
                <h3>{plugin.name}</h3><p>{plugin.description}</p>
                <div className="plugin-social"><span>{plugin.users} instalações</span><span>{active ? "Ativo" : "Disponível"}</span></div>
                <footer><button className="button secondary" onClick={() => togglePlugin(plugin.id)}>{active ? <><Trash2 /> Remover</> : <><Plus /> Instalar</>}</button><button className="icon-button" aria-label={`Configurar ${plugin.name}`} onClick={() => setConfiguring(plugin)}><SlidersHorizontal /></button></footer>
              </article>
            );
          })}
        </div>

        {configuring && (
          <aside className="plugin-drawer panel">
            <header><div><span className="eyebrow">CONFIGURAÇÃO</span><h2>{configuring.name}</h2></div><button className="icon-button" onClick={() => setConfiguring(null)} aria-label="Fechar configuração">×</button></header>
            <div className="drawer-icon"><configuring.icon /></div>
            <label className="control-label" htmlFor="instance-name">Nome da instância</label><input id="instance-name" defaultValue={configuring.name} />
            <label className="control-label" htmlFor="plugin-refresh">Atualização mínima</label><select id="plugin-refresh" defaultValue="15"><option value="5">5 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option></select>
            <label className="control-label" htmlFor="plugin-url">Endpoint opcional</label><div className="input-with-icon"><Link /><input id="plugin-url" placeholder="https://api.exemplo.com/dados" /></div>
            <div className="privacy-note"><ShieldCheck /><span>Credenciais criptografadas localmente. Nenhum dado é compartilhado com a LumaBoard.</span></div>
            <button className="button primary full" onClick={() => { setConfiguring(null); onToast("Configuração salva com segurança."); }}><Save /> Salvar configuração</button>
          </aside>
        )}
      </div>
    </section>
  );
}

type Rule = { id: number; name: string; trigger: string; action: string; enabled: boolean };
const defaultRules: Rule[] = [
  { id: 1, name: "Modo trabalho", trigger: "Seg–Sex às 08:00", action: "Ativar playlist Trabalho", enabled: true },
  { id: 2, name: "Economia noturna", trigger: "Todos os dias às 22:30", action: "Suspender atualizações", enabled: true },
  { id: 3, name: "Alerta de chuva", trigger: "Chuva > 60%", action: "Priorizar tela Clima", enabled: true },
];

export function AutomationModule({ onToast }: { onToast: ToastHandler }) {
  const [rules, setRules] = useState(defaultRules);
  const [showForm, setShowForm] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [localOnly, setLocalOnly] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem("lumaboard-rules");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Rule[];
      if (Array.isArray(saved)) queueMicrotask(() => setRules(saved));
    } catch {
      // Keep defaults.
    }
  }, []);

  const persistRules = (next: Rule[]) => {
    setRules(next);
    window.localStorage.setItem("lumaboard-rules", JSON.stringify(next));
  };

  const addRule = () => {
    if (!ruleName.trim()) return;
    persistRules([...rules, { id: Date.now(), name: ruleName.trim(), trigger: "Quando os dados mudarem", action: "Atualizar dispositivo Sala", enabled: true }]);
    setRuleName(""); setShowForm(false); onToast("Automação criada e ativada.");
  };

  const exportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      studio: window.localStorage.getItem("lumaboard-studio"),
      playlist: window.localStorage.getItem("lumaboard-playlist"),
      plugins: window.localStorage.getItem("lumaboard-plugins"),
      rules,
    };
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
        const payload = JSON.parse(String(reader.result)) as Record<string, unknown>;
        if (typeof payload.studio === "string") window.localStorage.setItem("lumaboard-studio", payload.studio);
        if (typeof payload.playlist === "string") window.localStorage.setItem("lumaboard-playlist", payload.playlist);
        if (typeof payload.plugins === "string") window.localStorage.setItem("lumaboard-plugins", payload.plugins);
        if (Array.isArray(payload.rules)) persistRules(payload.rules as Rule[]);
        onToast("Backup restaurado. Recarregue para aplicar todas as preferências.");
      } catch { onToast("Arquivo de backup inválido."); }
    };
    reader.readAsText(file);
  };

  return (
    <section className="module-view">
      <ModuleHeading eyebrow="REGRAS E PRIVACIDADE" title="Automação local-first." description="Crie comportamentos por horário, dados ou bateria. Tudo funciona no navegador ou no seu servidor." action={<button className="button primary" onClick={() => setShowForm(true)}><Plus /> Nova automação</button>} />

      {showForm && <div className="inline-form panel"><div><span className="eyebrow">NOVA REGRA</span><h3>Automação rápida</h3></div><input aria-label="Nome da automação" placeholder="Ex.: Lembrete para sair" value={ruleName} onChange={(event) => setRuleName(event.target.value)} /><select aria-label="Gatilho" defaultValue="change"><option value="change">Quando os dados mudarem</option><option value="time">Em um horário</option><option value="battery">Bateria abaixo de 20%</option></select><button className="button primary" onClick={addRule}>Criar</button><button className="icon-button" aria-label="Cancelar" onClick={() => setShowForm(false)}>×</button></div>}

      <div className="automation-layout">
        <article className="rules-panel panel">
          <header className="list-header"><div><strong>Regras ativas</strong><span>{rules.filter((rule) => rule.enabled).length} de {rules.length} executando</span></div><button className="icon-button compact" aria-label="Atualizar regras"><RefreshCw /></button></header>
          <div className="rules-list">
            {rules.map((rule) => <article key={rule.id}><span className="rule-icon"><Zap /></span><div><strong>{rule.name}</strong><span><AlarmClock /> {rule.trigger}</span><small><ChevronRight /> {rule.action}</small></div><label className="switch"><input type="checkbox" checked={rule.enabled} onChange={(event) => persistRules(rules.map((current) => current.id === rule.id ? { ...current, enabled: event.target.checked } : current))} /><span /></label><button className="icon-button compact" aria-label={`Excluir ${rule.name}`} onClick={() => persistRules(rules.filter((current) => current.id !== rule.id))}><Trash2 /></button></article>)}
          </div>
        </article>

        <aside className="settings-stack">
          <article className="panel privacy-panel"><span className="privacy-icon"><ShieldCheck /></span><div><span className="eyebrow">PRIVACIDADE</span><h3>Modo local</h3><p>Nenhuma configuração sai deste navegador. Você pode exportar tudo quando quiser.</p></div><label className="switch"><input type="checkbox" checked={localOnly} onChange={(event) => setLocalOnly(event.target.checked)} /><span /></label></article>
          <article className="panel backup-panel"><span className="eyebrow">PORTABILIDADE</span><h3>Backup e restauração</h3><p>Leve playlists, plugins e regras para outra instalação LumaBoard.</p><div><button className="button secondary" onClick={exportBackup}><Download /> Exportar JSON</button><label className="button secondary upload-button"><Upload /> Importar<input type="file" accept="application/json,.json" onChange={importBackup} /></label></div></article>
          <article className="panel endpoint-panel"><span className="eyebrow">API DO DISPOSITIVO</span><h3>Endpoint universal</h3><code className="mono">GET /api/display/:token</code><button className="button secondary full" onClick={() => { navigator.clipboard?.writeText("https://lumaboard.local/api/display/demo-token"); onToast("Endpoint copiado."); }}><Copy /> Copiar endpoint</button></article>
        </aside>
      </div>
    </section>
  );
}
