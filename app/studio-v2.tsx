/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Clock3,
  CloudSun,
  Copy,
  Download,
  Eye,
  Focus,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  ListMusic,
  Monitor,
  Newspaper,
  Plus,
  Save,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  createDefaultDashboardState,
  createShareUrl,
  createWidget,
  normalizeDashboardState,
  readDashboardState,
  resolveScheduledLayout,
  writeDashboardState,
  type DashboardLayout,
  type DashboardState,
  type DashboardWidget,
  type DashboardWidgetType,
  type PlaylistRule,
} from "./dashboard-config";
import { DashboardRenderer, type DashboardRenderData } from "./dashboard-renderer";

const widgetOptions: Array<{ type: DashboardWidgetType; label: string; icon: typeof Clock3 }> = [
  { type: "clock", label: "Relógio", icon: Clock3 },
  { type: "agenda", label: "Agenda", icon: CalendarDays },
  { type: "weather", label: "Tempo", icon: CloudSun },
  { type: "focus", label: "Foco", icon: Focus },
  { type: "news", label: "Notícias", icon: Newspaper },
  { type: "anime", label: "Anime", icon: Sparkles },
  { type: "economy", label: "Economia", icon: LayoutGrid },
  { type: "music", label: "Música", icon: ListMusic },
];

const dayLabels = ["D", "S", "T", "Q", "Q", "S", "S"];

type ToastHandler = (message: string) => void;

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function cloneLayout(layout: DashboardLayout): DashboardLayout {
  const id = `layout-${Date.now()}`;
  return {
    ...layout,
    id,
    name: `${layout.name} cópia`,
    widgets: layout.widgets.map((widget) => ({ ...widget, id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })),
  };
}

function LayoutCanvas({
  layout,
  state,
  selectedWidgetId,
  renderData,
  previewMode,
  onSelect,
  onReorder,
}: {
  layout: DashboardLayout;
  state: DashboardState;
  selectedWidgetId: string | null;
  renderData: DashboardRenderData;
  previewMode: "desktop" | "tablet" | "phone" | "eink";
  onSelect: (id: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <div className={`visual-canvas preview-${previewMode}`}>
      <div className="visual-canvas-label"><Monitor /> {previewMode.toUpperCase()} · {layout.columns} COLUNAS</div>
      <div
        className={`visual-editor-grid renderer-bg-${layout.background}`}
        style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, gap: layout.gap }}
      >
        {layout.widgets.map((widget) => (
          <button
            type="button"
            draggable
            key={widget.id}
            className={`visual-widget-frame ${selectedWidgetId === widget.id ? "selected" : ""} ${!widget.enabled ? "disabled" : ""}`}
            style={{ gridColumn: `span ${Math.min(layout.columns, widget.colSpan)}`, gridRow: `span ${widget.rowSpan}` }}
            onClick={() => onSelect(widget.id)}
            onDragStart={() => setDragId(widget.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragId && dragId !== widget.id) onReorder(dragId, widget.id);
              setDragId(null);
            }}
          >
            <span className="visual-widget-drag"><GripVertical /></span>
            <span>{widget.title}</span>
            <small>{widget.colSpan}×{widget.rowSpan}</small>
          </button>
        ))}
      </div>
      <DashboardRenderer layout={layout} settings={state.settings} data={renderData} className="visual-live-preview" />
    </div>
  );
}

export function StudioModuleV2({ renderData, onToast }: { renderData: DashboardRenderData; onToast: ToastHandler }) {
  const [state, setState] = useState(createDefaultDashboardState);
  const [layoutId, setLayoutId] = useState("layout-morning");
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "phone" | "eink">("desktop");
  const [shareUrl, setShareUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readDashboardState();
    queueMicrotask(() => {
      setState(saved);
      const initialLayout = saved.layouts.find((item) => item.id === saved.settings.defaultLayoutId) ?? saved.layouts[0];
      setLayoutId(initialLayout.id);
      setSelectedWidgetId(initialLayout.widgets[0]?.id ?? null);
    });
  }, []);

  const layout = state.layouts.find((item) => item.id === layoutId) ?? state.layouts[0];
  const selectedWidget = layout.widgets.find((item) => item.id === selectedWidgetId) ?? null;

  const persist = (next: DashboardState, message?: string) => {
    const saved = writeDashboardState(next);
    setState(saved);
    if (message) onToast(message);
  };

  const patchLayout = (patch: Partial<DashboardLayout>) => {
    persist({ ...state, layouts: state.layouts.map((item) => item.id === layout.id ? { ...item, ...patch } : item) });
  };

  const patchWidget = (patch: Partial<DashboardWidget>) => {
    if (!selectedWidget) return;
    patchLayout({ widgets: layout.widgets.map((item) => item.id === selectedWidget.id ? { ...item, ...patch } : item) });
  };

  const addWidget = (type: DashboardWidgetType) => {
    const widget = createWidget(type);
    patchLayout({ widgets: [...layout.widgets, widget] });
    setSelectedWidgetId(widget.id);
    onToast(`${widget.title} adicionado ao painel.`);
  };

  const removeWidget = () => {
    if (!selectedWidget) return;
    const nextWidgets = layout.widgets.filter((item) => item.id !== selectedWidget.id);
    patchLayout({ widgets: nextWidgets });
    setSelectedWidgetId(nextWidgets[0]?.id ?? null);
    onToast("Widget removido do layout.");
  };

  const reorder = (sourceId: string, targetId: string) => {
    const sourceIndex = layout.widgets.findIndex((item) => item.id === sourceId);
    const targetIndex = layout.widgets.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const widgets = [...layout.widgets];
    const [moved] = widgets.splice(sourceIndex, 1);
    widgets.splice(targetIndex, 0, moved);
    patchLayout({ widgets });
  };

  const addLayout = () => {
    const next: DashboardLayout = {
      id: `layout-${Date.now()}`,
      name: "Novo painel",
      columns: 3,
      gap: 14,
      background: "paper",
      widgets: [createWidget("clock"), createWidget("weather"), createWidget("agenda")],
    };
    persist({ ...state, layouts: [...state.layouts, next] }, "Novo layout criado.");
    setLayoutId(next.id);
    setSelectedWidgetId(next.widgets[0].id);
  };

  const duplicateLayout = () => {
    const copy = cloneLayout(layout);
    persist({ ...state, layouts: [...state.layouts, copy] }, "Layout duplicado.");
    setLayoutId(copy.id);
    setSelectedWidgetId(copy.widgets[0]?.id ?? null);
  };

  const deleteLayout = () => {
    if (state.layouts.length <= 1) {
      onToast("Mantenha pelo menos um layout.");
      return;
    }
    const nextLayouts = state.layouts.filter((item) => item.id !== layout.id);
    const nextPlaylist = state.playlist.filter((rule) => rule.layoutId !== layout.id);
    const nextDefault = state.settings.defaultLayoutId === layout.id ? nextLayouts[0].id : state.settings.defaultLayoutId;
    persist({ ...state, layouts: nextLayouts, playlist: nextPlaylist, settings: { ...state.settings, defaultLayoutId: nextDefault } }, "Layout excluído.");
    setLayoutId(nextLayouts[0].id);
    setSelectedWidgetId(nextLayouts[0].widgets[0]?.id ?? null);
  };

  const createLink = async () => {
    const url = createShareUrl(state, window.location.origin);
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      onToast("Link completo do display copiado.");
    } catch {
      onToast("Link criado; copie-o na área de compartilhamento.");
    }
  };

  const exportSelectedLayout = () => {
    const selectedState: DashboardState = {
      ...state,
      layouts: [layout],
      playlist: state.playlist.filter((rule) => rule.layoutId === layout.id),
      settings: { ...state.settings, defaultLayoutId: layout.id },
      updatedAt: new Date().toISOString(),
    };
    const slug = layout.name.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "painel";
    downloadText(`lumaboard-${slug}.lumaboard.json`, JSON.stringify(selectedState, null, 2));
    onToast("Tela atual exportada em um arquivo local.");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const next = normalizeDashboardState(parsed);
      persist(next, "Layouts e programação importados.");
      setLayoutId(next.settings.defaultLayoutId);
      setSelectedWidgetId(next.layouts[0].widgets[0]?.id ?? null);
    } catch {
      onToast("Arquivo de layout inválido.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="module-view visual-studio-view">
      <header className="module-heading">
        <div><span className="eyebrow">VISUAL DASHBOARD STUDIO</span><h1>Monte telas arrastando blocos.</h1><p>Crie layouts, redimensione widgets, programe playlists e compartilhe tudo sem conta ou banco de dados.</p></div>
        <div className="module-actions">
          <button className="button secondary" onClick={exportSelectedLayout}><Download /> Exportar tela</button>
          <button className="button secondary" onClick={() => downloadText(`lumaboard-completo-${new Date().toISOString().slice(0, 10)}.lumaboard.json`, JSON.stringify(state, null, 2))}><Download /> Exportar tudo</button>
          <button className="button secondary" onClick={() => fileRef.current?.click()}><Upload /> Importar</button>
          <input ref={fileRef} hidden type="file" accept="application/json,.json,.lumaboard.json" onChange={(event) => void importFile(event)} />
          <button className="button primary" onClick={() => persist(state, "Layouts salvos no localStorage.")}><Save /> Salvar</button>
        </div>
      </header>

      <div className="visual-studio-layout">
        <aside className="panel visual-library-panel">
          <div className="tool-panel-title"><strong>Layouts</strong><button className="icon-button compact" onClick={addLayout} aria-label="Novo layout"><Plus /></button></div>
          <div className="layout-list-v2">
            {state.layouts.map((item) => <button key={item.id} className={item.id === layout.id ? "active" : ""} onClick={() => { setLayoutId(item.id); setSelectedWidgetId(item.widgets[0]?.id ?? null); }}><LayoutGrid /><span><strong>{item.name}</strong><small>{item.widgets.length} widgets · {item.columns} col.</small></span></button>)}
          </div>
          <div className="layout-actions-v2"><button className="button secondary" onClick={duplicateLayout}><Copy /> Duplicar</button><button className="button secondary danger" onClick={deleteLayout}><Trash2 /> Excluir</button></div>
          <div className="tool-panel-title spaced"><strong>Adicionar widget</strong></div>
          <div className="widget-palette-v2">
            {widgetOptions.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => addWidget(type)}><Icon /><span>{label}</span><Plus /></button>)}
          </div>
        </aside>

        <article className="panel visual-canvas-panel">
          <header className="visual-canvas-toolbar">
            <div className="preview-device-switch">
              {(["desktop", "tablet", "phone", "eink"] as const).map((mode) => <button key={mode} className={previewMode === mode ? "active" : ""} onClick={() => setPreviewMode(mode)}>{mode === "desktop" ? "Desktop" : mode === "tablet" ? "Tablet" : mode === "phone" ? "Celular" : "E-paper"}</button>)}
            </div>
            <span className="status-chip"><GripVertical /> ARRASTE PARA REORDENAR</span>
          </header>
          <LayoutCanvas layout={layout} state={state} selectedWidgetId={selectedWidgetId} renderData={renderData} previewMode={previewMode} onSelect={setSelectedWidgetId} onReorder={reorder} />
        </article>

        <aside className="panel visual-inspector-panel">
          <div className="tool-panel-title"><strong>Layout</strong><ImageIcon /></div>
          <label>Nome<input value={layout.name} onChange={(event) => patchLayout({ name: event.target.value })} /></label>
          <div className="two-field-row"><label>Colunas<select value={layout.columns} onChange={(event) => patchLayout({ columns: Number(event.target.value) as 1 | 2 | 3 | 4 })}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label><label>Espaço<input type="number" min="0" max="32" value={layout.gap} onChange={(event) => patchLayout({ gap: Number(event.target.value) })} /></label></div>
          <label>Fundo<select value={layout.background} onChange={(event) => patchLayout({ background: event.target.value as DashboardLayout["background"] })}><option value="paper">Papel</option><option value="night">Noturno</option><option value="eink">E-paper</option><option value="transparent">Transparente</option></select></label>
          <label className="check-row"><input type="checkbox" checked={state.settings.defaultLayoutId === layout.id} onChange={() => persist({ ...state, settings: { ...state.settings, defaultLayoutId: layout.id } })} /> Tela padrão</label>

          <div className="tool-panel-title spaced"><strong>Widget selecionado</strong><GripVertical /></div>
          {!selectedWidget && <p className="empty-inspector">Selecione um widget no canvas.</p>}
          {selectedWidget && <>
            <label>Título<input value={selectedWidget.title} onChange={(event) => patchWidget({ title: event.target.value })} /></label>
            <div className="two-field-row"><label>Largura<select value={selectedWidget.colSpan} onChange={(event) => patchWidget({ colSpan: Number(event.target.value) })}><option value="1">1 coluna</option><option value="2">2 colunas</option><option value="3">3 colunas</option><option value="4">4 colunas</option></select></label><label>Altura<select value={selectedWidget.rowSpan} onChange={(event) => patchWidget({ rowSpan: Number(event.target.value) })}><option value="1">1 linha</option><option value="2">2 linhas</option><option value="3">3 linhas</option></select></label></div>
            <label>Tamanho da fonte<input type="range" min="0.75" max="1.6" step="0.05" value={selectedWidget.fontScale} onChange={(event) => patchWidget({ fontScale: Number(event.target.value) })} /></label>
            <label>Opacidade<input type="range" min="0.45" max="1" step="0.05" value={selectedWidget.opacity} onChange={(event) => patchWidget({ opacity: Number(event.target.value) })} /></label>
            <label>Fundo<select value={selectedWidget.background} onChange={(event) => patchWidget({ background: event.target.value as DashboardWidget["background"] })}><option value="surface">Cartão</option><option value="paper">Papel</option><option value="transparent">Transparente</option></select></label>
            <label className="check-row"><input type="checkbox" checked={selectedWidget.showHeader} onChange={(event) => patchWidget({ showHeader: event.target.checked })} /> Mostrar cabeçalho</label>
            <label className="check-row"><input type="checkbox" checked={selectedWidget.bordered} onChange={(event) => patchWidget({ bordered: event.target.checked })} /> Mostrar borda</label>
            <label className="check-row"><input type="checkbox" checked={selectedWidget.enabled} onChange={(event) => patchWidget({ enabled: event.target.checked })} /> Widget ativo</label>
            <button className="button secondary danger full" onClick={removeWidget}><Trash2 /> Remover widget</button>
          </>}

          <div className="tool-panel-title spaced"><strong>Compartilhar</strong><Copy /></div>
          <button className="button primary full" onClick={() => void createLink()}><Copy /> Copiar link</button>
          {shareUrl && <div className="share-box-v2"><input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />{shareUrl.length <= 1800 ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`} alt="QR code do display" loading="lazy" referrerPolicy="no-referrer" /> : <small>Este layout gerou um link grande demais para um QR confiável. Exporte o JSON da tela e importe-o no outro aparelho.</small>}<small>O QR é gerado somente quando esta caixa é aberta. A configuração viaja dentro do link.</small></div>}
          <a className="button secondary full" href="/display" target="_blank" rel="noreferrer"><Eye /> Abrir modo display</a>
        </aside>
      </div>
    </section>
  );
}

function ruleActiveLabel(rule: PlaylistRule): string {
  const days = rule.days.length === 7 ? "Todos os dias" : rule.days.map((day) => dayLabels[day]).join(" ");
  return `${days} · ${rule.startTime}–${rule.endTime}`;
}

export function PlaylistsModuleV2({ onToast, city }: { onToast: ToastHandler; city: string }) {
  const [state, setState] = useState(createDefaultDashboardState);
  const [simulationHour, setSimulationHour] = useState(new Date().getHours());

  useEffect(() => { queueMicrotask(() => setState(readDashboardState())); }, []);

  const persist = (next: DashboardState, message?: string) => {
    const saved = writeDashboardState(next);
    setState(saved);
    if (message) onToast(message);
  };

  const patchRule = (id: string, patch: Partial<PlaylistRule>) => persist({ ...state, playlist: state.playlist.map((rule) => rule.id === id ? { ...rule, ...patch } : rule) });
  const addRule = () => {
    const rule: PlaylistRule = {
      id: `rule-${Date.now()}`,
      name: "Nova faixa de horário",
      layoutId: state.settings.defaultLayoutId,
      enabled: true,
      days: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "18:00",
      durationSeconds: 45,
      order: state.playlist.length,
    };
    persist({ ...state, playlist: [...state.playlist, rule] }, "Faixa de horário adicionada.");
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= state.playlist.length) return;
    const list = [...state.playlist];
    [list[index], list[target]] = [list[target], list[index]];
    persist({ ...state, playlist: list.map((rule, order) => ({ ...rule, order })) });
  };

  const simulatedLayout = useMemo(() => {
    const date = new Date();
    date.setHours(simulationHour, 0, 0, 0);
    return resolveScheduledLayout(state, date);
  }, [simulationHour, state]);

  return (
    <section className="module-view playlist-v2-view">
      <header className="module-heading"><div><span className="eyebrow">PLAYLISTS REAIS</span><h1>Troque telas por horário.</h1><p>Defina dias, janelas, duração, ordem, transição e comportamento do display. Tudo fica no localStorage.</p></div><div className="module-actions"><button className="button primary" onClick={addRule}><Plus /> Nova faixa</button></div></header>
      <div className="playlist-v2-layout">
        <article className="panel playlist-v2-panel">
          <header className="playlist-v2-header"><div><strong>Programação local</strong><span>{state.playlist.filter((rule) => rule.enabled).length} faixas ativas · {city}</span></div><span className="status-chip"><Check /> MOTOR ATIVO</span></header>
          <div className="playlist-rules-v2">
            {state.playlist.map((rule, index) => <article key={rule.id} className={!rule.enabled ? "disabled" : ""}>
              <div className="playlist-order-v2"><button className="icon-button compact" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></button><button className="icon-button compact" disabled={index === state.playlist.length - 1} onClick={() => move(index, 1)}><ArrowDown /></button></div>
              <div className="playlist-rule-main"><input value={rule.name} onChange={(event) => patchRule(rule.id, { name: event.target.value })} /><select value={rule.layoutId} onChange={(event) => patchRule(rule.id, { layoutId: event.target.value })}>{state.layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name}</option>)}</select><small>{ruleActiveLabel(rule)}</small></div>
              <div className="playlist-day-picker">{dayLabels.map((label, day) => <button key={`${rule.id}-${day}`} className={rule.days.includes(day) ? "active" : ""} onClick={() => patchRule(rule.id, { days: rule.days.includes(day) ? rule.days.filter((value) => value !== day) : [...rule.days, day].sort() })}>{label}</button>)}</div>
              <div className="playlist-times-v2"><label>Início<input type="time" value={rule.startTime} onChange={(event) => patchRule(rule.id, { startTime: event.target.value })} /></label><label>Fim<input type="time" value={rule.endTime} onChange={(event) => patchRule(rule.id, { endTime: event.target.value })} /></label><label>Duração<select value={rule.durationSeconds} onChange={(event) => patchRule(rule.id, { durationSeconds: Number(event.target.value) })}><option value="10">10 s</option><option value="30">30 s</option><option value="45">45 s</option><option value="60">1 min</option><option value="300">5 min</option><option value="900">15 min</option></select></label></div>
              <label className="switch"><input type="checkbox" checked={rule.enabled} onChange={(event) => patchRule(rule.id, { enabled: event.target.checked })} /><span /></label>
              <button className="icon-button compact" onClick={() => persist({ ...state, playlist: state.playlist.filter((item) => item.id !== rule.id) }, "Faixa removida.")}><Trash2 /></button>
            </article>)}
          </div>
        </article>

        <aside className="playlist-settings-v2">
          <article className="panel">
            <span className="eyebrow">COMPORTAMENTO</span>
            <label>Tela padrão<select value={state.settings.defaultLayoutId} onChange={(event) => persist({ ...state, settings: { ...state.settings, defaultLayoutId: event.target.value } })}>{state.layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name}</option>)}</select></label>
            <label>Transição<select value={state.settings.transition} onChange={(event) => persist({ ...state, settings: { ...state.settings, transition: event.target.value as DashboardState["settings"]["transition"] } })}><option value="fade">Suave</option><option value="slide">Deslizar</option><option value="none">Sem transição</option></select></label>
            <label>Tempo da transição<input type="range" min="0" max="3" step="0.1" value={state.settings.transitionSeconds} onChange={(event) => persist({ ...state, settings: { ...state.settings, transitionSeconds: Number(event.target.value) } })} /></label>
            <label>Duração da pausa<select value={state.settings.pauseSeconds} onChange={(event) => persist({ ...state, settings: { ...state.settings, pauseSeconds: Number(event.target.value) } })}><option value="30">30 segundos</option><option value="60">1 minuto</option><option value="90">1 min 30 s</option><option value="300">5 minutos</option><option value="900">15 minutos</option></select></label>
            <label>Carrossel do display<select value={state.settings.newsCarouselSeconds} onChange={(event) => persist({ ...state, settings: { ...state.settings, newsCarouselSeconds: Number(event.target.value) } })}><option value="5">5 segundos</option><option value="8">8 segundos</option><option value="15">15 segundos</option><option value="30">30 segundos</option></select></label>
            <label>Fonte de tecnologia<select value={state.settings.newsSource} onChange={(event) => persist({ ...state, settings: { ...state.settings, newsSource: event.target.value as DashboardState["settings"]["newsSource"] } })}><option value="all">Todas</option><option value="hacker-news">Hacker News</option><option value="dev-community">DEV Community</option></select></label>
            <label className="check-row"><input type="checkbox" checked={state.settings.newsImageOnly} onChange={(event) => persist({ ...state, settings: { ...state.settings, newsImageOnly: event.target.checked } })} /> Notícias somente com imagem</label>
            <label className="check-row"><input type="checkbox" checked={state.settings.randomize} onChange={(event) => persist({ ...state, settings: { ...state.settings, randomize: event.target.checked } })} /><Shuffle /> Ordem aleatória por dia</label>
            <label className="check-row"><input type="checkbox" checked={state.settings.pauseOnInteraction} onChange={(event) => persist({ ...state, settings: { ...state.settings, pauseOnInteraction: event.target.checked } })} /> Pausar ao interagir</label>
            <label className="check-row"><input type="checkbox" checked={state.settings.preventSleep} onChange={(event) => persist({ ...state, settings: { ...state.settings, preventSleep: event.target.checked } })} /> Impedir suspensão quando suportado</label>
            <label className="check-row"><input type="checkbox" checked={state.settings.hideCursor} onChange={(event) => persist({ ...state, settings: { ...state.settings, hideCursor: event.target.checked } })} /> Ocultar cursor no display</label>
            <label className="check-row"><input type="checkbox" checked={state.settings.showStatus} onChange={(event) => persist({ ...state, settings: { ...state.settings, showStatus: event.target.checked } })} /> Mostrar status no rodapé</label>
          </article>
          <article className="panel simulation-card-v2"><span className="eyebrow">SIMULAÇÃO</span><strong>{String(simulationHour).padStart(2, "0")}:00</strong><input type="range" min="0" max="23" value={simulationHour} onChange={(event) => setSimulationHour(Number(event.target.value))} /><div><Monitor /><span><strong>{simulatedLayout.name}</strong><small>{state.playlist.some((rule) => rule.layoutId === simulatedLayout.id && rule.enabled) ? "Selecionada pela programação" : "Tela padrão"}</small></span></div></article>
          <a className="button primary full" href="/display" target="_blank" rel="noreferrer"><Eye /> Abrir display real</a>
        </aside>
      </div>
    </section>
  );
}
