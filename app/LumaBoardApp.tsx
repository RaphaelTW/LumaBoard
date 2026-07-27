"use client";

import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleGauge,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Code2,
  Columns3,
  Focus,
  Grid2X2,
  Library,
  ListMusic,
  Maximize2,
  Monitor,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Copy,
  WandSparkles,
  X,
  Zap,
  Search,
  Radio,
  Wrench,
  Command,
  Palette,
  Smartphone,
  CloudDownload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  RAIN_RULE_ID,
  defaultAutomationState,
  evaluateRainRule,
  readAutomationState,
  recordRainAlert,
  type LocalAutomationRule,
} from "./automation";
import {
  AutomationModule,
  DevicesModule,
  LibraryModule,
  PlaylistsModule,
  StudioModule,
  type View,
} from "./modules";
import { type WeatherSnapshot, useLocalWeather } from "./weather";
import {
  formatTimer,
  getNextOccurrence,
  recurrenceLabel,
  agendaCategoryLabel,
  type AgendaCategory,
  type AgendaColor,
  type AgendaEvent,
  type AgendaKind,
  type AgendaOccurrence,
  type AgendaRecurrence,
  type FocusSession,
  useLocalWidgets,
} from "./local-widgets";
import {
  DEFAULT_PUBLIC_PLUGIN_IDS,
  normalizeEnabledPublicPlugins,
  usePublicSummary,
} from "./public-data";
import { PublicExplorer } from "./public-explorer";
import { MusicModule } from "./music-module";
import { DiagnosticsModule } from "./diagnostics-module";
import { DashboardRenderer, type DashboardRenderData } from "./dashboard-renderer";
import { createShareUrl, readDashboardState, readMusicCache, resolveScheduledLayout, type DashboardState } from "./dashboard-config";
import { AgendaModule } from "./agenda-module";
import { AppearanceModule } from "./appearance-module";
import { ExperienceModule } from "./experience-module";
import { APP_VERSION, usePWA } from "./pwa-manager";
import { CHANGELOG } from "./changelog-data";
import { useThemeSystem } from "./theme-system";
import { readStoredValue, writeStoredValue } from "./storage";
import { PublicDataPanel } from "./public-data-panel";
import { GlobalSearchDialog } from "./global-search-dialog";

const navItems: Array<{ id: View; label: string; mobileLabel?: string; icon: typeof Grid2X2 }> = [
  { id: "overview", label: "Visão geral", mobileLabel: "Início", icon: Grid2X2 },
  { id: "agenda", label: "Agenda", mobileLabel: "Agenda", icon: CalendarDays },
  { id: "studio", label: "Estúdio", mobileLabel: "Estúdio", icon: WandSparkles },
  { id: "playlists", label: "Playlists", mobileLabel: "Listas", icon: ListMusic },
  { id: "devices", label: "Dispositivos", icon: Monitor },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "automation", label: "Automação", icon: Zap },
  { id: "music", label: "Música", icon: Radio },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "experience", label: "Experiência", icon: Smartphone },
  { id: "diagnostics", label: "Diagnóstico", icon: Wrench },
];

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

const weekDays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const DEFAULT_PUBLIC_PLUGINS = [...DEFAULT_PUBLIC_PLUGIN_IDS];

function safeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "America/Sao_Paulo";
  }
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: safeTimezone(timezone),
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value.replace(".", "") ?? "";
  return {
    weekday: read("weekday").toUpperCase(),
    day: read("day"),
    month: read("month").toUpperCase(),
    year: Number(read("year")),
    monthNumber: Number(
      new Intl.DateTimeFormat("en", {
        timeZone: safeTimezone(timezone),
        month: "numeric",
      }).format(date),
    ),
  };
}

function calendarModel(date: Date, timezone: string) {
  const current = zonedParts(date, timezone);
  const today = new Date(
    Date.UTC(current.year, current.monthNumber - 1, Number(current.day)),
  );
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - mondayOffset - 7);

  return {
    kicker: `${current.weekday}, ${current.day} ${current.month}`,
    tile: { day: current.day, month: current.month },
    days: Array.from({ length: 14 }, (_, index) => {
      const item = new Date(start);
      item.setUTCDate(start.getUTCDate() + index);
      return {
        key: item.toISOString(),
        day: item.getUTCDate(),
        today:
          item.getUTCFullYear() === today.getUTCFullYear() &&
          item.getUTCMonth() === today.getUTCMonth() &&
          item.getUTCDate() === today.getUTCDate(),
      };
    }),
  };
}

function WeatherGlyph({ weather }: { weather: WeatherSnapshot }) {
  const code = weather.weatherCode;
  if (code === 0) return weather.isDay ? <Sun /> : <Moon />;
  if (code === 1 || code === 2) return <CloudSun />;
  if (code === 3) return <Cloud />;
  if (code === 45 || code === 48) return <CloudFog />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain />;
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return <CloudSnow />;
  }
  if (code >= 95) return <CloudLightning />;
  return <CloudSun />;
}

function Logo() {
  return (
    <div className="brand" aria-label="LumaBoard">
      <span className="brand-mark" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => (
          <i key={index} style={{ transform: `rotate(${index * 30}deg)` }} />
        ))}
      </span>
      <span>LumaBoard</span>
    </div>
  );
}

function EInkPreview({
  refreshing = false,
  weather,
  now,
  event,
  focus,
}: {
  refreshing?: boolean;
  weather: WeatherSnapshot;
  now: Date;
  event: AgendaEvent | null;
  focus: FocusSession;
}) {
  const calendar = calendarModel(now, weather.timezone);
  const temperature =
    weather.temperature === null ? "--°" : `${Math.round(weather.temperature)}°`;
  const minimum =
    weather.minimum === null ? "--°" : `${Math.round(weather.minimum)}°`;
  const maximum =
    weather.maximum === null ? "--°" : `${Math.round(weather.maximum)}°`;

  return (
    <div className={`eink-screen ${refreshing ? "is-refreshing" : ""}`}>
      <section className="eink-calendar">
        <div className="mono eink-kicker">{calendar.kicker}</div>
        <div className="eink-rule" />
        <div className="calendar-week mono">
          {weekDays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid mono">
          {calendar.days.map((item) => (
            <span className={item.today ? "today" : ""} key={item.key}>
              {item.day}
            </span>
          ))}
        </div>
        <div className="calendar-event">
          <span>{event?.time ?? "--:--"}</span>
          <strong>{event?.title ?? "Sem compromissos"}</strong>
        </div>
      </section>

      <section className="eink-weather">
        <div className="mono eink-kicker weather-city">{weather.city.toUpperCase()}</div>
        <WeatherGlyph weather={weather} />
        <strong className="temperature mono">{temperature}</strong>
        <span className="mono">{minimum} / {maximum}</span>
        <small>{weather.description}</small>
        <small className="weather-attribution">Open-Meteo · BigDataCloud</small>
      </section>

      <section className="eink-focus">
        <div className="mono eink-kicker">FOCO</div>
        <div className="eink-rule" />
        <strong className="focus-time mono">{formatTimer(focus.remainingSeconds)}</strong>
        <span>{focus.project}</span>
        <div className="focus-ring" aria-hidden="true">
          {focus.running ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </div>
        <div className="task-line">
          <Check aria-hidden="true" />
          <span>{focus.task}</span>
        </div>
      </section>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">LUMABOARD</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}


type SharedDisplayConfig = {
  event: AgendaEvent | null;
  focus: FocusSession;
};

function normalizeSharedAgendaEvent(value: unknown): AgendaEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<AgendaEvent>;
  if (
    typeof event.id !== "string" ||
    typeof event.title !== "string" ||
    typeof event.date !== "string" ||
    typeof event.time !== "string"
  ) return null;
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    kind: event.kind === "task" ? "task" : "reminder",
    recurrence:
      event.recurrence === "daily" ||
      event.recurrence === "weekly" ||
      event.recurrence === "monthly" ||
      event.recurrence === "yearly"
        ? event.recurrence
        : "once",
    category: event.category === "work" || event.category === "health" || event.category === "finance" || event.category === "study" || event.category === "other" ? event.category : "personal",
    color: event.color === "amber" || event.color === "cyan" || event.color === "rose" || event.color === "slate" ? event.color : "moss",
    completedDates: Array.isArray(event.completedDates)
      ? event.completedDates.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function isSharedFocus(value: unknown): value is FocusSession {
  if (!value || typeof value !== "object") return false;
  const focus = value as Partial<FocusSession>;
  return (
    typeof focus.project === "string" &&
    typeof focus.task === "string" &&
    typeof focus.durationMinutes === "number" &&
    Number.isFinite(focus.durationMinutes) &&
    typeof focus.remainingSeconds === "number" &&
    Number.isFinite(focus.remainingSeconds) &&
    typeof focus.running === "boolean" &&
    (focus.endsAt === null || (typeof focus.endsAt === "number" && Number.isFinite(focus.endsAt)))
  );
}

function decodeDisplayConfig(encoded: string): SharedDisplayConfig | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<SharedDisplayConfig>;
    if (!isSharedFocus(candidate.focus)) return null;
    const normalizedEvent = candidate.event === null || candidate.event === undefined
      ? null
      : normalizeSharedAgendaEvent(candidate.event);
    if (candidate.event !== null && candidate.event !== undefined && !normalizedEvent) return null;
    const remainingSeconds = candidate.focus.running && candidate.focus.endsAt
      ? Math.max(0, Math.ceil((candidate.focus.endsAt - Date.now()) / 1000))
      : candidate.focus.remainingSeconds;
    return {
      event: normalizedEvent,
      focus: {
        ...candidate.focus,
        remainingSeconds,
        running: candidate.focus.running && remainingSeconds > 0,
        endsAt: candidate.focus.running && remainingSeconds > 0 ? candidate.focus.endsAt : null,
      },
    };
  } catch {
    return null;
  }
}

function formatPublicDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function LocalWidgetsPanel({
  events,
  nextEvent,
  dueEvents,
  overdueTasks,
  notificationPermission,
  focus,
  todayKey,
  onAddEvent,
  onRemoveEvent,
  onToggleEventCompleted,
  onRequestNotifications,
  onUpdateFocus,
  onSetFocusDuration,
  onToggleFocus,
  onResetFocus,
  onToast,
}: {
  events: AgendaEvent[];
  nextEvent: AgendaOccurrence | null;
  dueEvents: AgendaOccurrence[];
  overdueTasks: AgendaOccurrence[];
  notificationPermission: NotificationPermission | "unsupported";
  focus: FocusSession;
  todayKey: string;
  onAddEvent: (event: Omit<AgendaEvent, "id" | "completedDates">) => boolean;
  onRemoveEvent: (id: string) => void;
  onToggleEventCompleted: (id: string, occurrenceDate: string) => void;
  onRequestNotifications: () => Promise<NotificationPermission | "unsupported">;
  onUpdateFocus: (patch: Partial<FocusSession>) => void;
  onSetFocusDuration: (minutes: number) => void;
  onToggleFocus: () => void;
  onResetFocus: () => void;
  onToast: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState("09:00");
  const [kind, setKind] = useState<AgendaKind>("reminder");
  const [recurrence, setRecurrence] = useState<AgendaRecurrence>("once");
  const [category, setCategory] = useState<AgendaCategory>("personal");
  const [color, setColor] = useState<AgendaColor>("moss");

  const submitEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onAddEvent({ title, date, time, kind, recurrence, category, color })) {
      onToast("Preencha título, data e horário válidos.");
      return;
    }
    setTitle("");
    onToast(recurrence === "once" ? "Item salvo neste navegador." : "Recorrência salva neste navegador.");
  };

  const activateNotifications = async () => {
    const result = await onRequestNotifications();
    if (result === "granted") onToast("Notificações locais ativadas enquanto o LumaBoard estiver aberto.");
    else if (result === "denied") onToast("Permissão de notificações bloqueada pelo navegador.");
    else onToast("Este navegador não oferece notificações locais.");
  };

  return (
    <section className="local-data-section">
      <header className="section-heading">
        <div>
          <span className="eyebrow">MEMÓRIA LOCAL</span>
          <h2>Agenda recorrente, categorias e foco.</h2>
        </div>
        <div className="local-heading-actions">
          <span className="status-chip"><span className="status-dot" /> LOCALSTORAGE</span>
          <button className="button secondary" onClick={() => void activateNotifications()} disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}>
            <Bell /> {notificationPermission === "granted" ? "Alertas ativos" : "Ativar alertas"}
          </button>
        </div>
      </header>

      {overdueTasks.length > 0 && <div className="overdue-counter panel"><Bell /><div><strong>{overdueTasks.length} tarefa(s) atrasada(s)</strong><span>{overdueTasks.slice(0, 3).map((item) => `${formatPublicDate(item.occurrenceDate)} · ${item.title}`).join(" • ")}</span></div></div>}

      {dueEvents.length > 0 && (
        <div className="due-events panel" role="status">
          <Bell />
          <div><strong>{dueEvents.length === 1 ? "Há um item vencendo agora" : `${dueEvents.length} itens vencendo agora`}</strong><span>{dueEvents.map((item) => `${item.time} · ${item.title}`).join(" • ")}</span></div>
        </div>
      )}

      <div className="local-widgets-grid">
        <article className="panel local-widget-card agenda-control-card">
          <header><CalendarDays /><div><strong>Agenda local</strong><span>{nextEvent ? `Próximo: ${nextEvent.time} · ${formatPublicDate(nextEvent.occurrenceDate)}` : "Nenhum compromisso futuro"}</span></div></header>
          <form className="event-form recurring-event-form" onSubmit={submitEvent}>
            <input aria-label="Título" placeholder="Novo lembrete ou tarefa" value={title} onChange={(event) => setTitle(event.target.value)} />
            <select aria-label="Tipo" value={kind} onChange={(event) => setKind(event.target.value as AgendaKind)}>
              <option value="reminder">Lembrete</option>
              <option value="task">Tarefa</option>
            </select>
            <select aria-label="Repetição" value={recurrence} onChange={(event) => setRecurrence(event.target.value as AgendaRecurrence)}>
              <option value="once">Uma vez</option>
              <option value="daily">Todo dia</option>
              <option value="weekly">Toda semana</option>
              <option value="monthly">Todo mês</option>
              <option value="yearly">Todo ano</option>
            </select>
            <select aria-label="Categoria" value={category} onChange={(event) => setCategory(event.target.value as AgendaCategory)}>
              <option value="personal">Pessoal</option><option value="work">Trabalho</option><option value="health">Saúde</option><option value="finance">Finanças</option><option value="study">Estudos</option><option value="other">Outro</option>
            </select>
            <select aria-label="Cor" value={color} onChange={(event) => setColor(event.target.value as AgendaColor)}>
              <option value="moss">Verde</option><option value="amber">Âmbar</option><option value="cyan">Azul</option><option value="rose">Rosa</option><option value="slate">Cinza</option>
            </select>
            <input aria-label="Data inicial" type="date" min={todayKey} value={date} onChange={(event) => setDate(event.target.value)} />
            <input aria-label="Horário" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            <button className="button primary" type="submit"><Plus /> Adicionar</button>
          </form>
          <p className="local-note">Exemplo: selecione <strong>Todo mês</strong> e a data 26 para repetir no dia 26 de cada mês. Os alertas do navegador funcionam enquanto a página estiver aberta.</p>
          <div className="event-list recurring-list">
            {events.length === 0 && <p>Os itens ficam somente neste navegador e entram na prévia automaticamente.</p>}
            {[...events]
              .sort((a, b) => {
                const nextA = getNextOccurrence(a, todayKey);
                const nextB = getNextOccurrence(b, todayKey);
                const keyA = nextA ? `${nextA.occurrenceDate}T${nextA.time}` : `9999-${a.date}T${a.time}`;
                const keyB = nextB ? `${nextB.occurrenceDate}T${nextB.time}` : `9999-${b.date}T${b.time}`;
                return keyA.localeCompare(keyB);
              })
              .slice(0, 8)
              .map((item) => {
              const next = getNextOccurrence(item, todayKey);
              const occurrenceDate = next?.occurrenceDate ?? item.date;
              const finished = !next && item.recurrence === "once" && item.completedDates.includes(item.date);
              return (
                <div className={`${finished ? "is-completed" : ""} event-color-${item.color}`} key={item.id}>
                  <span className="mono">{formatPublicDate(occurrenceDate)} · {item.time}</span>
                  <div className="event-copy"><strong>{item.title}</strong><small>{item.kind === "task" ? "Tarefa" : "Lembrete"} · {agendaCategoryLabel(item.category)} · {recurrenceLabel(item.recurrence)}</small></div>
                  <div className="event-actions">
                    <button className="icon-button compact" aria-label={finished ? `Reabrir ${item.title}` : `Concluir ${item.title}`} onClick={() => onToggleEventCompleted(item.id, occurrenceDate)}><Check /></button>
                    <button className="icon-button compact" aria-label={`Excluir ${item.title}`} onClick={() => onRemoveEvent(item.id)}><Trash2 /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel local-widget-card focus-control-card">
          <header><Focus /><div><strong>Temporizador de foco</strong><span>{focus.running ? "Sessão em andamento" : "Pronto para começar"}</span></div></header>
          <strong className="local-focus-time mono">{formatTimer(focus.remainingSeconds)}</strong>
          <div className="focus-fields">
            <input aria-label="Projeto" value={focus.project} onChange={(event) => onUpdateFocus({ project: event.target.value })} />
            <input aria-label="Tarefa atual" value={focus.task} onChange={(event) => onUpdateFocus({ task: event.target.value })} />
            <label>Duração
              <select value={focus.durationMinutes} onChange={(event) => onSetFocusDuration(Number(event.target.value))} disabled={focus.running}>
                <option value="15">15 min</option>
                <option value="25">25 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </label>
          </div>
          <div className="focus-actions">
            <button className="button primary" onClick={onToggleFocus}>{focus.running ? <><Pause /> Pausar</> : <><Play /> Iniciar</>}</button>
            <button className="button secondary" onClick={onResetFocus}><RotateCcw /> Reiniciar</button>
          </div>
          <p className="local-note">A tarefa do Pomodoro permanece até você alterá-la. Para tarefas concluíveis ou recorrentes, use a agenda acima.</p>
        </article>
      </div>
    </section>
  );
}

export function LumaBoardApp() {
  const pwa = usePWA();
  const { state: themeState, profile: themeProfile, persist: persistTheme } = useThemeSystem();
  const theme = themeProfile.mode === "night" || themeProfile.mode === "oled" ? "night" : "paper";
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeView, setActiveView] = useState<View>("overview");
  const [displayMode, setDisplayMode] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"create" | "device" | "preview" | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);
  const [musicCache, setMusicCache] = useState(() => readMusicCache());
  const [enabledPublicPlugins, setEnabledPublicPlugins] = useState<string[]>(DEFAULT_PUBLIC_PLUGINS);
  const {
    weather,
    status: weatherStatus,
    refresh: refreshWeather,
    setManualLocation,
  } = useLocalWeather();
  const localWidgets = useLocalWidgets();
  const {
    summary: publicSummary,
    status: publicDataStatus,
    refresh: refreshPublicData,
  } = usePublicSummary(
    weather.latitude,
    weather.longitude,
    weather.city,
    weather.stateCode,
    weather.timezone,
  );
  const [sharedConfig, setSharedConfig] = useState<SharedDisplayConfig | null>(null);
  const [automationState, setAutomationState] = useState(defaultAutomationState);
  const [avatarInitials, setAvatarInitials] = useState("RS");
  const rainRule =
    automationState.rules.find((rule) => rule.id === RAIN_RULE_ID) ??
    defaultAutomationState.rules[0];
  const rainEvaluation = useMemo(
    () => evaluateRainRule(rainRule, weather, now),
    [rainRule, weather, now],
  );

  const calendar = useMemo(
    () => calendarModel(now, weather.timezone),
    [now, weather.timezone],
  );
  const previewEvent = sharedConfig?.event ?? localWidgets.nextEvent;
  const previewFocus = sharedConfig?.focus ?? localWidgets.focus;
  const dashboardLayout = dashboardState ? resolveScheduledLayout(dashboardState, now) : null;
  const dashboardRenderData = useMemo<DashboardRenderData>(() => ({
    now,
    weather,
    focus: localWidgets.focus,
    upcomingEvents: localWidgets.upcomingEvents,
    overdueCount: localWidgets.overdueTasks.length,
    summary: publicSummary,
    music: musicCache,
  }), [now, weather, localWidgets.focus, localWidgets.upcomingEvents, localWidgets.overdueTasks.length, publicSummary, musicCache]);

  const notificationCount =
    localWidgets.unreadNotificationCount +
    localWidgets.overdueTasks.length +
    (pwa.updateAvailable ? 1 : 0) +
    (publicDataStatus === "error" ? 1 : 0) +
    (weatherStatus === "error" ? 1 : 0) +
    (!pwa.online ? 1 : 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const profile = readStoredValue(
        "lumaboard-user-profile-v1",
        (value): value is { initials: string } => typeof value === "object" && value !== null && "initials" in value && typeof (value as { initials?: unknown }).initials === "string",
        { initials: "RS" },
      );
      setAvatarInitials(profile.initials.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").slice(0, 3).toUpperCase() || "RS");
      setAutomationState(readAutomationState());
      setDashboardState(readDashboardState());
      setMusicCache(readMusicCache());
    });
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const encodedConfig = hashParams.get("config");
    if (encodedConfig) {
      const decoded = decodeDisplayConfig(encodedConfig);
      if (decoded) queueMicrotask(() => setSharedConfig(decoded));
    }
    if (params.get("display") === "1") queueMicrotask(() => setDisplayMode(true));
    const requestedView = params.get("view") ?? window.localStorage.getItem("lumaboard-last-view-v1");
    if (requestedView && navItems.some((item) => item.id === requestedView)) queueMicrotask(() => setActiveView(requestedView as View));
  }, []);

  useEffect(() => {
    const syncDashboard = (event: Event) => {
      if (event instanceof CustomEvent && event.detail) setDashboardState(event.detail as DashboardState);
      else setDashboardState(readDashboardState());
    };
    const syncMusic = (event: Event) => {
      if (event instanceof CustomEvent && event.detail) setMusicCache(event.detail);
      else setMusicCache(readMusicCache());
    };
    window.addEventListener("lumaboard:dashboard", syncDashboard);
    window.addEventListener("lumaboard:music", syncMusic);
    window.addEventListener("storage", syncDashboard);
    window.addEventListener("storage", syncMusic);
    return () => {
      window.removeEventListener("lumaboard:dashboard", syncDashboard);
      window.removeEventListener("lumaboard:music", syncMusic);
      window.removeEventListener("storage", syncDashboard);
      window.removeEventListener("storage", syncMusic);
    };
  }, []);

  useEffect(() => {
    const readEnabled = () => {
      try {
        const stored: unknown = JSON.parse(window.localStorage.getItem("lumaboard-plugins") ?? "null");
        return normalizeEnabledPublicPlugins(stored);
      } catch {
        return DEFAULT_PUBLIC_PLUGINS;
      }
    };
    const syncEnabled = (event?: Event) => {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) {
        setEnabledPublicPlugins(normalizeEnabledPublicPlugins(event.detail));
        return;
      }
      setEnabledPublicPlugins(readEnabled());
    };
    queueMicrotask(() => syncEnabled());
    window.addEventListener("lumaboard:plugins", syncEnabled);
    window.addEventListener("storage", syncEnabled);
    return () => {
      window.removeEventListener("lumaboard:plugins", syncEnabled);
      window.removeEventListener("storage", syncEnabled);
    };
  }, []);

  useEffect(() => {
    writeStoredValue("lumaboard-last-view-v1", activeView);
    const url = new URL(window.location.href);
    if (activeView === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", activeView);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [activeView]);

  const updateAvatarInitials = useCallback((value: string) => {
    const next = value.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").slice(0, 3).toUpperCase() || "EU";
    setAvatarInitials(next);
    writeStoredValue("lumaboard-user-profile-v1", { initials: next });
    setToast("Iniciais do perfil salvas neste navegador.");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const deviceState = useMemo(
    () => ({ name: "Display local", synced: "agora" }),
    [],
  );

  const refreshDevice = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    void Promise.all([refreshWeather(), refreshPublicData()]).finally(() => {
      window.setTimeout(() => {
        setRefreshing(false);
        setToast("Clima, APIs públicas e prévia atualizados.");
      }, 420);
    });
  }, [refreshPublicData, refreshWeather, refreshing]);

  useEffect(() => {
    const reconnect = () => refreshDevice();
    window.addEventListener("lumaboard:reconnect", reconnect);
    return () => window.removeEventListener("lumaboard:reconnect", reconnect);
  }, [refreshDevice]);

  const copyDisplayLink = async () => {
    const state = dashboardState ?? readDashboardState();
    const url = createShareUrl(state, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link completo do display copiado.");
    } catch {
      window.prompt("Copie o link do display:", url);
    }
  };

  const updateRainRule = (nextRule: LocalAutomationRule) => {
    setAutomationState((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule)),
    }));
  };

  const clearRainHistory = () => {
    const next = {
      ...readAutomationState(),
      history: [],
    };
    writeStoredValue("lumaboard-rules", next);
    setAutomationState(next);
    setToast("Histórico de alertas limpo.");
  };

  useEffect(() => {
    const state = readAutomationState();
    const rule = state.rules.find((item) => item.id === RAIN_RULE_ID);
    if (!rule) return;
    const evaluation = evaluateRainRule(rule, weather, new Date());
    const evaluated = {
      ...state,
      rules: state.rules.map((item) =>
        item.id === RAIN_RULE_ID
          ? { ...item, lastEvaluatedAt: new Date().toISOString() }
          : item,
      ),
    };
    const next = recordRainAlert(evaluated, rule, evaluation);
    writeStoredValue("lumaboard-rules", next);
    queueMicrotask(() => setAutomationState(next));
    if (!evaluation.shouldAlert || evaluation.maxProbability === null) return;
    queueMicrotask(() => {
      setToast(`Chuva provável: ${evaluation.maxProbability}% nas próximas 6h.`);
      setActiveView("automation");
    });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("LumaBoard: alerta de chuva", {
        body: `Probabilidade de ${evaluation.maxProbability}% perto de ${weather.city}.`,
      });
    }
  }, [weather, weatherStatus]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (editing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key.toLocaleLowerCase() === "d") {
        window.open("/display", "_blank", "noopener,noreferrer");
      } else if (event.key.toLocaleLowerCase() === "r") {
        refreshDevice();
      } else if (/^[1-9]$/.test(event.key)) {
        const item = navItems[Number(event.key) - 1];
        if (item) setActiveView(item.id);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [refreshDevice]);

  const toggleTheme = () => {
    const next = theme === "paper" ? "night" : "paper";
    persistTheme({ ...themeState, activeThemeId: next });
  };



  if (displayMode) {
    return (
      <div className="app-shell display-mode display-mode-v2" data-theme={theme}>
        <button className="display-exit button secondary" onClick={() => setDisplayMode(false)}>
          <X /> Sair do modo display
        </button>
        <div className="display-canvas">
          {dashboardState && dashboardLayout
            ? <DashboardRenderer layout={dashboardLayout} settings={dashboardState.settings} data={dashboardRenderData} className="embedded-display-preview" />
            : <EInkPreview weather={weather} now={now} event={previewEvent} focus={previewFocus} />}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      <aside className="sidebar">
        <Logo />
        <nav aria-label="Navegação principal">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-item ${activeView === id ? "active" : ""}`}
              key={label}
              aria-current={activeView === id ? "page" : undefined}
              onClick={() => setActiveView(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-version" aria-label={`Versão ${APP_VERSION}`}>v{APP_VERSION}</div>
        <div className="sidebar-device">
          <div className="device-dot" />
          <div>
            <strong>{deviceState.name}</strong>
            <span>dados locais · sem conta</span>
          </div>
          <Monitor aria-hidden="true" />
        </div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Logo />
            <span
              className={`mobile-connection-dot ${pwa.online ? "" : "offline"}`}
              title={pwa.statusText}
              role="status"
              aria-label={pwa.statusText}
            />
          </div>
          <div className="crumb">
            <span className={`status-dot ${pwa.online ? "" : "offline"}`} />
            LumaBoard / {navItems.find((item) => item.id === activeView)?.label}
            <small className="data-freshness">{pwa.online ? <Wifi /> : <WifiOff />} {pwa.statusText}</small>
          </div>
          <div className="topbar-actions">
            <button className="version-pill" onClick={() => setActiveView("experience")} aria-label={`Abrir novidades da versão ${APP_VERSION}`}>v{APP_VERSION}</button>
            <button className="global-search-trigger" onClick={() => setSearchOpen(true)} aria-label="Abrir busca global">
              <Search /><span>Buscar no LumaBoard</span><kbd><Command /> K</kbd>
            </button>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Ativar tema ${theme === "paper" ? "noturno" : "claro"}`}
            >
              {theme === "paper" ? <Moon /> : <Sun />}
              <span>{theme === "paper" ? "Modo noturno" : "Modo papel"}</span>
            </button>
            <button
              className="icon-button"
              aria-label={`Notificações${notificationCount > 0 ? `: ${notificationCount} pendente(s)` : ""}`}
              aria-expanded={notificationPanelOpen}
              aria-controls="notification-quick-panel"
              onClick={() => setNotificationPanelOpen((open) => !open)}
            >
              <Bell />
              {notificationCount > 0 && <i className="notification-dot" />}
            </button>
            <button className="icon-button" aria-label="Configurações" onClick={() => setActiveView("appearance")}>
              <Settings />
            </button>
            <button className="avatar" aria-label={`Perfil local: ${avatarInitials}`} onClick={() => setActiveView("appearance")}>
              {avatarInitials}
            </button>
          </div>
        </header>

        {notificationPanelOpen && (
          <div className="notification-quick-backdrop" role="presentation" onClick={() => setNotificationPanelOpen(false)}>
            <section
              id="notification-quick-panel"
              className="notification-quick-panel panel"
              role="dialog"
              aria-modal="true"
              aria-label="Notificações rápidas"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <div><span className="eyebrow">NOTIFICAÇÕES</span><strong>{notificationCount > 0 ? `${notificationCount} item(ns) pedem atenção` : "Tudo em ordem"}</strong></div>
                <button className="icon-button compact" onClick={() => setNotificationPanelOpen(false)} aria-label="Fechar notificações"><X /></button>
              </header>
              <div className="notification-quick-list">
                {notificationCount === 0 && <p><Check /> Nenhuma tarefa vencida, falha ou atualização pendente.</p>}
                {localWidgets.notificationInbox.filter((item) => !item.readAt).slice(0, 4).map((item) => <button key={item.id} onClick={() => { localWidgets.markNotificationRead(item.id); setActiveView("agenda"); setNotificationPanelOpen(false); }}><Bell /><span><strong>{item.title}</strong><small>{item.body}</small></span></button>)}
                {localWidgets.overdueTasks.length > 0 && <button onClick={() => { setActiveView("agenda"); setNotificationPanelOpen(false); }}><CalendarDays /><span><strong>{localWidgets.overdueTasks.length} tarefa(s) atrasada(s)</strong><small>Abrir agenda e concluir ou reagendar.</small></span></button>}
                {pwa.updateAvailable && <button onClick={() => { setActiveView("experience"); setNotificationPanelOpen(false); }}><CloudDownload /><span><strong>Atualização disponível</strong><small>Abra Experiência para proteger os dados e atualizar.</small></span></button>}
                {(publicDataStatus === "error" || weatherStatus === "error") && <button onClick={() => { setActiveView("diagnostics"); setNotificationPanelOpen(false); }}><Wrench /><span><strong>Uma fonte pública falhou</strong><small>Abrir diagnóstico das APIs.</small></span></button>}
                {!pwa.online && <button onClick={() => { setActiveView("experience"); setNotificationPanelOpen(false); }}><WifiOff /><span><strong>Você está offline</strong><small>O LumaBoard está usando os últimos dados em cache.</small></span></button>}
                {localWidgets.notificationPermission !== "granted" && localWidgets.notificationPermission !== "unsupported" && <button onClick={() => { void localWidgets.requestNotifications().then((permission) => { setToast(permission === "granted" ? "Notificações locais ativadas." : "Permissão de notificações não concedida."); }); }}><Bell /><span><strong>Ativar alertas locais</strong><small>Funcionam enquanto o LumaBoard estiver aberto.</small></span></button>}
              </div>
              <footer><div className="notification-quick-footer-actions">{localWidgets.unreadNotificationCount > 0 && <button className="button secondary" onClick={localWidgets.markAllNotificationsRead}>Marcar lidas</button>}<button className="button primary" onClick={() => { setActiveView("experience"); setNotificationPanelOpen(false); }}>Abrir central completa</button></div></footer>
            </section>
          </div>
        )}

        {pwa.updateAvailable && <div className="global-update-banner"><CloudDownload /><span><strong>Atualização disponível</strong> Uma cópia local será criada antes de recarregar.</span><button onClick={pwa.applyUpdate}>Atualizar agora</button></div>}
        <main id="conteudo" className={`dashboard ${activeView !== "overview" ? "module-dashboard" : ""}`}>
          <div hidden={activeView !== "overview"}>
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
              <button className="button primary" onClick={() => setModal("create")}>
                <Plus /> Criar tela
              </button>
              <button className="button secondary" onClick={() => setModal("device")}>
                <Copy /> Gerar link do display
              </button>
            </div>
          </section>

          <button className="release-summary panel" onClick={() => setActiveView("experience")} aria-label="Abrir changelog completo">
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
                  <button
                    className="icon-button compact"
                    onClick={() => setModal("preview")}
                    aria-label="Ampliar prévia"
                  >
                    <Maximize2 />
                  </button>
                </div>
              </header>
              <button
                className="preview-button"
                onClick={() => setModal("preview")}
                aria-label="Abrir prévia em tela ampliada"
              >
                <EInkPreview refreshing={refreshing} weather={weather} now={now} event={previewEvent} focus={previewFocus} />
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
                <button className="button primary full" onClick={refreshDevice} disabled={refreshing}>
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
                  <span className="date-tile mono">{calendar.tile.day}<small>{calendar.tile.month}</small></span>
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

          <LocalWidgetsPanel
            events={localWidgets.events}
            nextEvent={localWidgets.nextEvent}
            dueEvents={localWidgets.dueEvents}
            overdueTasks={localWidgets.overdueTasks}
            notificationPermission={localWidgets.notificationPermission}
            focus={localWidgets.focus}
            todayKey={localWidgets.todayKey}
            onAddEvent={localWidgets.addEvent}
            onRemoveEvent={localWidgets.removeEvent}
            onToggleEventCompleted={localWidgets.toggleEventCompleted}
            onRequestNotifications={localWidgets.requestNotifications}
            onUpdateFocus={localWidgets.updateFocus}
            onSetFocusDuration={localWidgets.setFocusDuration}
            onToggleFocus={localWidgets.toggleFocus}
            onResetFocus={localWidgets.resetFocus}
            onToast={setToast}
          />

          <PublicDataPanel
            summary={publicSummary}
            status={publicDataStatus}
            onRefresh={() => void refreshPublicData()}
            enabled={enabledPublicPlugins}
          />

          <PublicExplorer
            onUseLocation={setManualLocation}
            onUseMachineLocation={() => refreshWeather(true)}
            onToast={setToast}
          />

          <section className="metric-grid" aria-label="Resumo operacional">
            <article className="metric panel"><span className="metric-icon"><Monitor /></span><div><strong>1</strong><span>display local</span><small>link compartilhável, sem pareamento</small></div></article>
            <article className="metric panel"><span className="metric-icon"><CloudSun /></span><div><strong>{enabledPublicPlugins.length}</strong><span>fontes opcionais visíveis</span><small>{DEFAULT_PUBLIC_PLUGINS.length} disponíveis sem chave</small></div></article>
            <article className="metric panel"><span className="metric-icon"><CircleGauge /></span><div><strong>0</strong><span>contas obrigatórias</span><small>nenhum token armazenado</small></div></article>
            <article className="insight panel"><span className="metric-icon"><Sparkles /></span><div><strong>Backend sem estado</strong><span>A Function apenas normaliza dados públicos; agenda, foco e preferências ficam no localStorage.</span></div></article>
          </section>

          <section className="plugins-section">
            <header className="section-heading">
              <div><span className="eyebrow">BIBLIOTECA</span><h2>Plugins em destaque</h2></div>
              <button className="text-button" onClick={() => setActiveView("library")}>Ver todos <ChevronRight /></button>
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
                  <button className="text-button" onClick={() => setActiveView("library")}>Configurar <SlidersHorizontal /></button>
                </article>
              ))}
            </div>
          </section>
          </div>

          {activeView === "agenda" && <AgendaModule onToast={setToast} />}
          {activeView === "studio" && <StudioModule renderData={dashboardRenderData} onToast={setToast} />}
          {activeView === "playlists" && <PlaylistsModule onToast={setToast} city={weather.city} />}
          {activeView === "devices" && (
            <DevicesModule
              preview={dashboardState && dashboardLayout ? <DashboardRenderer layout={dashboardLayout} settings={dashboardState.settings} data={dashboardRenderData} className="device-dashboard-preview" /> : <EInkPreview weather={weather} now={now} event={previewEvent} focus={previewFocus} />}
              onToast={setToast}
              onDisplay={() => window.open("/display", "_blank", "noopener,noreferrer")}
              onCopyLink={() => void copyDisplayLink()}
            />
          )}
          {activeView === "library" && <LibraryModule onToast={setToast} />}
          {activeView === "automation" && (
            <AutomationModule
              onToast={setToast}
              weather={weather}
              weatherStatus={weatherStatus}
              rainEvaluation={rainEvaluation}
              onUpdateRainRule={updateRainRule}
              onClearRainHistory={clearRainHistory}
            />
          )}
          {activeView === "music" && <MusicModule onToast={setToast} />}
          {activeView === "appearance" && <AppearanceModule onToast={setToast} avatarInitials={avatarInitials} onAvatarInitialsChange={updateAvatarInitials} />}
          {activeView === "experience" && <ExperienceModule summary={publicSummary} publicStatus={publicDataStatus} weatherStatus={weatherStatus} onToast={setToast} />}
          {activeView === "diagnostics" && (
            <DiagnosticsModule
              weatherStatus={weatherStatus}
              publicStatus={publicDataStatus}
              summary={publicSummary}
              onRefresh={async () => { await Promise.all([refreshWeather(true), refreshPublicData()]); }}
              onToast={setToast}
            />
          )}
        </main>
      </div>

      {modal === "create" && (
        <Modal title="Como você quer começar?" onClose={() => setModal(null)}>
          <div className="choice-grid">
            {[
              { icon: Columns3, title: "Template", text: "Comece com Agenda, Tempo ou Foco." },
              { icon: Plus, title: "Tela em branco", text: "Monte livremente no Estúdio Visual." },
              { icon: Code2, title: "Importar", text: "Use JSON, HTML seguro ou uma URL de API." },
            ].map(({ icon: Icon, title, text }) => (
              <button key={title} onClick={() => { setModal(null); setActiveView("studio"); setToast(`${title} selecionado. Abrindo o Estúdio…`); }}>
                <Icon /><strong>{title}</strong><span>{text}</span><ChevronRight />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === "device" && (
        <Modal title="Abrir em outro display" onClose={() => setModal(null)}>
          <div className="pairing-flow">
            <div className="pairing-copy"><span className="pair-icon"><Monitor /></span><div><h3>Compartilhe layouts e programação sem conta</h3><p>O link transporta os layouts, widgets e playlists. Agenda, preferências pessoais e caches permanecem somente no navegador de origem.</p></div></div>
            <div className="privacy-note"><Copy /><span>A configuração vai no fragmento <code>#config</code> da URL e não é armazenada pelo Netlify.</span></div>
            <button className="button primary full" onClick={() => { void copyDisplayLink(); setModal(null); }}><Copy /> Copiar link do display</button>
            <a className="button secondary full" href="/display" target="_blank" rel="noreferrer"><Monitor /> Abrir modo display</a>
          </div>
        </Modal>
      )}

      {modal === "preview" && (
        <Modal title={dashboardLayout?.name ?? "Prévia 800 × 480"} onClose={() => setModal(null)}>
          <div className="expanded-preview">
            {dashboardState && dashboardLayout
              ? <DashboardRenderer layout={dashboardLayout} settings={dashboardState.settings} data={dashboardRenderData} className="modal-dashboard-preview" />
              : <EInkPreview refreshing={refreshing} weather={weather} now={now} event={previewEvent} focus={previewFocus} />}
            <div className="expanded-actions"><span className="mono">LAYOUT LOCAL-FIRST</span><button className="button primary" onClick={refreshDevice}><RefreshCw /> Atualizar dados</button></div>
          </div>
        </Modal>
      )}

      {searchOpen && (
        <GlobalSearchDialog
          events={localWidgets.events}
          summary={publicSummary}
          layouts={dashboardState?.layouts ?? []}
          navItems={navItems}
          onNavigate={setActiveView}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        <Check /> {toast}
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" role="presentation" onClick={() => setMobileMenuOpen(false)}>
          <section className="mobile-module-sheet" role="dialog" aria-modal="true" aria-label="Todos os módulos" onClick={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">NAVEGAÇÃO</span><strong>Todos os módulos</strong></div><button className="icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu"><X /></button></header>
            <div>
              {navItems.map(({ id, label, icon: Icon }) => (
                <button key={id} className={activeView === id ? "active" : ""} onClick={() => { setActiveView(id); setMobileMenuOpen(false); }}>
                  <Icon /><span>{label}</span>
                </button>
              ))}
            </div>
            <footer>
              <span>LumaBoard v{APP_VERSION}</span>
              <button onClick={() => { setActiveView("experience"); setMobileMenuOpen(false); }}>Ver changelog</button>
            </footer>
          </section>
        </div>
      )}

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.slice(0, 4).map(({ id, label, mobileLabel, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={activeView === id ? "active" : ""}
            aria-label={label}
            aria-current={activeView === id ? "page" : undefined}
            onClick={() => { setActiveView(id); setNotificationPanelOpen(false); }}
          >
            <Icon /><span>{mobileLabel ?? label}</span>
          </button>
        ))}
        <button type="button" className={navItems.slice(4).some((item) => item.id === activeView) ? "active" : ""} aria-label="Abrir todos os módulos" aria-expanded={mobileMenuOpen} onClick={() => { setNotificationPanelOpen(false); setMobileMenuOpen(true); }}>
          <MoreHorizontal /><span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
