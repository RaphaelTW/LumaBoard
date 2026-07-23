"use client";

import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Code2,
  Activity,
  BookOpen,
  Droplets,
  Columns3,
  Focus,
  Grid2X2,
  Library,
  ListMusic,
  Landmark,
  MapPin,
  Maximize2,
  Mountain,
  Monitor,
  Moon,
  MoreHorizontal,
  Newspaper,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Tv,
  Waves,
  Trash2,
  Wind,
  DollarSign,
  ExternalLink,
  Copy,
  WandSparkles,
  X,
  Zap,
  Search,
  Radio,
  Wrench,
  Command,
  Bookmark,
  BookmarkCheck,
  EyeOff,
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
  describeAqi,
  type PublicAnimeItem,
  type PublicNewsItem,
  type PublicSummary,
  usePublicSummary,
} from "./public-data";
import { PublicExplorer } from "./public-explorer";
import { MusicModule } from "./music-module";
import { DiagnosticsModule } from "./diagnostics-module";
import { DashboardRenderer, type DashboardRenderData } from "./dashboard-renderer";
import { createShareUrl, readDashboardState, readMusicCache, resolveScheduledLayout, type DashboardState } from "./dashboard-config";

type Theme = "paper" | "night";

const navItems: Array<{ id: View; label: string; icon: typeof Grid2X2 }> = [
  { id: "overview", label: "Visão geral", icon: Grid2X2 },
  { id: "studio", label: "Estúdio", icon: WandSparkles },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "devices", label: "Dispositivos", icon: Monitor },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "automation", label: "Automação", icon: Zap },
  { id: "music", label: "Música", icon: Radio },
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

function formatPublicTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 5);
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatCompactNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDecimal(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatDayLength(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}min`;
}

function formatMoonPhase(value: string | null): string {
  const labels: Record<string, string> = {
    "New Moon": "Lua nova",
    "Waxing Crescent": "Lua crescente",
    "First Quarter": "Quarto crescente",
    "Waxing Gibbous": "Gibosa crescente",
    "Full Moon": "Lua cheia",
    "Waning Gibbous": "Gibosa minguante",
    "Last Quarter": "Quarto minguante",
    "Waning Crescent": "Lua minguante",
  };
  return value ? labels[value] ?? value : "Lua indisponível";
}


function formatNewsDate(value: string | null): string {
  if (!value) return "Agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}


type NewsPreferences = {
  source: string;
  intervalSeconds: number;
  imageOnly: boolean;
  savedOnly: boolean;
};

type NewsState = {
  readIds: string[];
  savedIds: string[];
};

function readNewsPreferences(label: string): NewsPreferences {
  const fallback: NewsPreferences = { source: "all", intervalSeconds: 8, imageOnly: false, savedOnly: false };
  if (typeof window === "undefined") return fallback;
  try {
    const all = JSON.parse(window.localStorage.getItem("lumaboard-news-preferences-v1") ?? "{}") as Record<string, Partial<NewsPreferences>>;
    const value = all[label] ?? {};
    return {
      source: typeof value.source === "string" ? value.source : "all",
      intervalSeconds: [5, 8, 15, 30].includes(Number(value.intervalSeconds)) ? Number(value.intervalSeconds) : 8,
      imageOnly: value.imageOnly === true,
      savedOnly: value.savedOnly === true,
    };
  } catch {
    return fallback;
  }
}

function writeNewsPreferences(label: string, value: NewsPreferences) {
  try {
    const all = JSON.parse(window.localStorage.getItem("lumaboard-news-preferences-v1") ?? "{}") as Record<string, NewsPreferences>;
    all[label] = value;
    window.localStorage.setItem("lumaboard-news-preferences-v1", JSON.stringify(all));
  } catch {
    window.localStorage.setItem("lumaboard-news-preferences-v1", JSON.stringify({ [label]: value }));
  }
}

function readNewsState(): NewsState {
  try {
    const value = JSON.parse(window.localStorage.getItem("lumaboard-news-state-v1") ?? "{}") as Partial<NewsState>;
    return {
      readIds: Array.isArray(value.readIds) ? value.readIds.filter((item): item is string => typeof item === "string") : [],
      savedIds: Array.isArray(value.savedIds) ? value.savedIds.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    return { readIds: [], savedIds: [] };
  }
}

function NewsCarousel({
  label,
  items,
  emptyMessage,
  accent,
  secondary,
}: {
  label: string;
  items: PublicNewsItem[];
  emptyMessage: string;
  accent: ReactNode;
  secondary?: PublicAnimeItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [preferences, setPreferences] = useState<NewsPreferences>(() => ({
    source: "all",
    intervalSeconds: 8,
    imageOnly: false,
    savedOnly: false,
  }));
  const [newsState, setNewsState] = useState<NewsState>({ readIds: [], savedIds: [] });

  useEffect(() => {
    queueMicrotask(() => {
      setPreferences(readNewsPreferences(label));
      setNewsState(readNewsState());
    });
  }, [label]);

  const sources = useMemo(
    () => Array.from(new Set(items.map((item) => item.source).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [items],
  );

  const visibleItems = useMemo(() => items.filter((item) => {
    if (preferences.source !== "all" && item.source !== preferences.source) return false;
    if (preferences.imageOnly && !item.imageUrl) return false;
    if (preferences.savedOnly && !newsState.savedIds.includes(item.id)) return false;
    return true;
  }), [items, newsState.savedIds, preferences]);

  const active = visibleItems.length ? visibleItems[activeIndex % visibleItems.length] : null;

  useEffect(() => {
    if (visibleItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visibleItems.length);
    }, preferences.intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [preferences.intervalSeconds, visibleItems.length]);

  useEffect(() => {
    if (activeIndex >= visibleItems.length) queueMicrotask(() => setActiveIndex(0));
  }, [activeIndex, visibleItems.length]);

  const updatePreferences = (patch: Partial<NewsPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    writeNewsPreferences(label, next);
    setActiveIndex(0);
  };

  const updateNewsState = (patch: Partial<NewsState>) => {
    const next = { ...newsState, ...patch };
    setNewsState(next);
    window.localStorage.setItem("lumaboard-news-state-v1", JSON.stringify(next));
  };

  const markRead = (id: string) => {
    if (newsState.readIds.includes(id)) return;
    updateNewsState({ readIds: [...newsState.readIds, id].slice(-300) });
  };

  const toggleSaved = (id: string) => {
    updateNewsState({
      savedIds: newsState.savedIds.includes(id)
        ? newsState.savedIds.filter((item) => item !== id)
        : [...newsState.savedIds, id].slice(-150),
    });
  };

  const move = (direction: -1 | 1) => {
    if (!visibleItems.length) return;
    setActiveIndex((current) => (current + direction + visibleItems.length) % visibleItems.length);
  };

  const isRead = active ? newsState.readIds.includes(active.id) : false;
  const isSaved = active ? newsState.savedIds.includes(active.id) : false;

  return (
    <article className={`panel public-data-card news-carousel-card ${isRead ? "is-read" : ""}`}>
      <header className="news-carousel-header">
        <span className="metric-icon">{accent}</span>
        <div><span>{label}</span><small>{visibleItems.length ? `${activeIndex + 1} de ${visibleItems.length}` : "Sem itens"}</small></div>
        <div className="news-carousel-controls">
          <button className="icon-button compact" aria-label={`Notícia anterior de ${label}`} onClick={() => move(-1)} disabled={visibleItems.length <= 1}><ChevronLeft /></button>
          <button className="icon-button compact" aria-label={`Próxima notícia de ${label}`} onClick={() => move(1)} disabled={visibleItems.length <= 1}><ChevronRight /></button>
        </div>
      </header>

      <div className="news-toolbar">
        <select aria-label={`Filtrar fontes de ${label}`} value={preferences.source} onChange={(event) => updatePreferences({ source: event.target.value })}>
          <option value="all">Todas as fontes</option>
          {sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <select aria-label={`Velocidade do carrossel de ${label}`} value={preferences.intervalSeconds} onChange={(event) => updatePreferences({ intervalSeconds: Number(event.target.value) })}>
          <option value="5">5 segundos</option>
          <option value="8">8 segundos</option>
          <option value="15">15 segundos</option>
          <option value="30">30 segundos</option>
        </select>
        <button className={`news-tool-button ${preferences.imageOnly ? "active" : ""}`} onClick={() => updatePreferences({ imageOnly: !preferences.imageOnly })}><EyeOff /> Com imagem</button>
        <button className={`news-tool-button ${preferences.savedOnly ? "active" : ""}`} onClick={() => updatePreferences({ savedOnly: !preferences.savedOnly })}>{preferences.savedOnly ? <BookmarkCheck /> : <Bookmark />} Salvas</button>
      </div>

      {active ? (
        <div className="news-carousel-slide" aria-live="polite">
          {active.imageUrl && (
            // Dynamic images come from allowlisted public providers and cannot use a fixed Next.js host list.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
          )}
          <div className="news-carousel-copy">
            <div className="news-item-state">
              {isRead && <span>LIDA</span>}
              {isSaved && <span>SALVA</span>}
            </div>
            <strong>{active.title}</strong>
            <span>{active.source} · {formatNewsDate(active.publishedAt)}{active.score > 0 ? ` · ${active.score} interações` : ""}</span>
            <div className="news-action-row">
              <a className="button secondary news-open-button" href={active.url} target="_blank" rel="noreferrer" onClick={() => markRead(active.id)}>Abrir notícia <ExternalLink /></a>
              <button className={`icon-button ${isSaved ? "active" : ""}`} aria-label={isSaved ? "Remover notícia dos salvos" : "Salvar notícia"} onClick={() => toggleSaved(active.id)}>{isSaved ? <BookmarkCheck /> : <Bookmark />}</button>
            </div>
          </div>
        </div>
      ) : <div className="news-carousel-empty">{preferences.savedOnly ? "Nenhuma notícia salva neste filtro." : emptyMessage}</div>}

      {visibleItems.length > 1 && (
        <div className="news-carousel-dots" aria-label={`Selecionar notícia de ${label}`}>
          {visibleItems.map((item, index) => <button key={item.id} className={index === activeIndex ? "active" : ""} aria-label={`Abrir notícia ${index + 1}`} onClick={() => setActiveIndex(index)} />)}
        </div>
      )}
      {secondary && secondary.length > 0 && (
        <div className="anime-trending-strip">
          <span>Em exibição</span>
          {secondary.slice(0, 3).map((anime) => <a href={anime.url} target="_blank" rel="noreferrer" key={anime.id}>{anime.title}{anime.score === null ? "" : ` · ${anime.score.toFixed(1)}`}</a>)}
        </div>
      )}
    </article>
  );
}

function GlobalSearchDialog({
  events,
  summary,
  layouts,
  onNavigate,
  onClose,
}: {
  events: AgendaEvent[];
  summary: PublicSummary;
  layouts: DashboardState["layouts"];
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

function PublicDataPanel({
  summary,
  status,
  onRefresh,
  enabled,
}: {
  summary: PublicSummary;
  status: "loading" | "ready" | "stale" | "error";
  onRefresh: () => void;
  enabled: string[];
}) {
  const ratesReady = summary.rates.usdBrl !== null || summary.rates.eurBrl !== null;
  const strongest = summary.earthquakes.strongest;
  const nearest = summary.earthquakes.nearest;
  const flood = summary.environment.flood;
  const marine = summary.environment.marine;
  const sunData = summary.environment.sun;
  const book = summary.content.book;
  const wikipedia = summary.content.wikipedia;
  const tv = summary.content.tv;

  return (
    <section className="public-data-section">
      <header className="section-heading">
        <div><span className="eyebrow">APIS SEM CHAVE</span><h2>Dados públicos atualizados.</h2></div>
        <button className="button secondary" onClick={onRefresh}><RefreshCw className={status === "loading" ? "spin" : ""} /> Atualizar dados</button>
      </header>
      <div className="public-data-grid expanded">
        {enabled.includes("air") && <article className="panel public-data-card"><span className="metric-icon"><Wind /></span><div><span>Qualidade do ar</span><strong>{summary.airQuality.europeanAqi ?? "—"} AQI</strong><small>{describeAqi(summary.airQuality.europeanAqi)} · PM2.5 {summary.airQuality.pm25 ?? "—"} µg/m³</small></div></article>}
        {enabled.includes("rates") && <article className="panel public-data-card"><span className="metric-icon"><DollarSign /></span><div><span>Câmbio</span><strong>{ratesReady ? `US$ ${summary.rates.usdBrl?.toFixed(2) ?? "—"}` : "Indisponível"}</strong><small>€ {summary.rates.eurBrl?.toFixed(2) ?? "—"} · {formatPublicDate(summary.rates.date)}</small></div></article>}
        {enabled.includes("holidays") && <article className="panel public-data-card"><span className="metric-icon"><CalendarDays /></span><div><span>Próximo feriado nacional</span><strong>{summary.nextHoliday?.name ?? "Consultando…"}</strong><small>{formatPublicDate(summary.nextHoliday?.date ?? null)} · BrasilAPI</small></div></article>}
        {enabled.includes("news") && <NewsCarousel label="Tecnologia" items={summary.news} emptyMessage="Notícias de tecnologia indisponíveis" accent={<Newspaper />} />}
        {enabled.includes("anime") && <NewsCarousel label="Notícias de anime" items={summary.anime.news} emptyMessage="Notícias de anime indisponíveis" accent={<Sparkles />} secondary={summary.anime.trending} />}
        {enabled.includes("economy") && <article className="panel public-data-card"><span className="metric-icon"><Landmark /></span><div><span>Economia do Brasil</span><strong>Selic {formatDecimal(summary.economy.selicAnnual, 2)}% a.a.</strong><small>IPCA mensal {formatDecimal(summary.economy.ipcaMonthly, 2)}% · Banco Central</small></div></article>}
        {enabled.includes("ibge") && <article className="panel public-data-card"><span className="metric-icon"><MapPin /></span><div><span>Município pelo IBGE</span><strong>{summary.ibge.municipality ?? "Local não identificado"}{summary.ibge.stateCode ? ` · ${summary.ibge.stateCode}` : ""}</strong><small>{summary.ibge.population !== null ? `${formatCompactNumber(summary.ibge.population)} habitantes · ${summary.ibge.populationYear ?? "estimativa"}` : summary.ibge.immediateRegion ?? "Dados regionais indisponíveis"}</small></div></article>}
        {enabled.includes("earthquakes") && <article className="panel public-data-card"><span className="metric-icon"><Activity /></span><div><span>Terremotos nas últimas 24h</span><strong>{summary.earthquakes.count24h} eventos</strong><small>{strongest ? `Maior M${formatDecimal(strongest.magnitude)} · ${strongest.place}` : "USGS sem eventos recentes"}{nearest && nearest.distanceKm !== null ? ` · mais próximo ${nearest.distanceKm} km` : ""}</small></div></article>}
        {enabled.includes("elevation") && <article className="panel public-data-card"><span className="metric-icon"><Mountain /></span><div><span>Altitude do local</span><strong>{summary.environment.elevationM === null ? "—" : `${Math.round(summary.environment.elevationM)} m`}</strong><small>Modelo digital de elevação · Open-Meteo</small></div></article>}
        {enabled.includes("flood") && <article className="panel public-data-card"><span className="metric-icon"><Droplets /></span><div><span>Rio e vazão estimada</span><strong>{flood.discharge === null ? "Sem rio modelado próximo" : `${formatDecimal(flood.discharge)} m³/s`}</strong><small>{flood.maximum === null ? "Open-Meteo Flood" : `máxima prevista ${formatDecimal(flood.maximum)} m³/s · ${formatPublicDate(flood.date)}`}</small></div></article>}
        {enabled.includes("marine") && <article className="panel public-data-card"><span className="metric-icon"><Waves /></span><div><span>Condição marítima</span><strong>{marine.waveHeightM === null ? "Fora da cobertura marítima" : `Ondas ${formatDecimal(marine.waveHeightM)} m`}</strong><small>{marine.seaTemperatureC === null ? "Disponível em coordenadas costeiras" : `mar ${formatDecimal(marine.seaTemperatureC)} °C · corrente ${formatDecimal(marine.currentVelocityKmh)} km/h`}</small></div></article>}
        {enabled.includes("sun") && <article className="panel public-data-card"><span className="metric-icon"><Sunrise /></span><div><span>Sol e Lua</span><strong>{formatPublicTime(sunData.sunrise)} → {formatPublicTime(sunData.sunset)}</strong><small>{formatDayLength(sunData.dayLengthSeconds)} de luz · {formatMoonPhase(sunData.moonPhase)}{sunData.moonIllumination === null ? "" : ` ${formatDecimal(sunData.moonIllumination)}%`} · <a href="https://sunrise-sunset.org/" target="_blank" rel="noreferrer">Sunrise-Sunset.org</a></small></div></article>}
        {enabled.includes("books") && <article className="panel public-data-card news-card"><span className="metric-icon"><BookOpen /></span><div><span>Livro em destaque</span><strong>{book?.title ?? "Livro indisponível"}</strong>{book && <a href={book.url} target="_blank" rel="noreferrer">{book.author}{book.year ? ` · ${book.year}` : ""} <ExternalLink /></a>}</div></article>}
        {enabled.includes("wikipedia") && <article className="panel public-data-card news-card"><span className="metric-icon"><Code2 /></span><div><span>Wikipédia</span><strong>{wikipedia?.title ?? "Artigo indisponível"}</strong>{wikipedia && <a href={wikipedia.url} target="_blank" rel="noreferrer">{wikipedia.description || wikipedia.excerpt || "Abrir artigo"} <ExternalLink /></a>}</div></article>}
        {enabled.includes("tv") && <article className="panel public-data-card news-card"><span className="metric-icon"><Tv /></span><div><span>TV e streaming hoje</span><strong>{tv?.show ?? "Sem programação brasileira encontrada"}</strong>{tv && <a href={tv.url} target="_blank" rel="noreferrer">{tv.episode} · {tv.time ?? "horário variável"} · {tv.network} <ExternalLink /></a>}</div></article>}
        {enabled.length === 0 && <article className="panel public-data-card empty-public-card"><span className="metric-icon"><Library /></span><div><span>Fontes opcionais ocultas</span><strong>Abra a Biblioteca</strong><small>Ative as fontes públicas que deseja exibir.</small></div></article>}
      </div>
      <footer className="public-data-footer"><span>{status === "ready" ? "Dados atualizados" : status === "stale" ? "Usando cache local" : status === "error" ? "APIs temporariamente indisponíveis" : "Conectando às APIs"}{summary.warnings.length ? ` · ${summary.warnings.length} fonte(s) com falha` : ""}</span><span>Cache local + Function sem estado · {summary.sources.length} provedores · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / CAMS / <a href="https://www.dwd.de/" target="_blank" rel="noreferrer">DWD</a></span></footer>
    </section>
  );
}

export function LumaBoardApp() {
  const [theme, setTheme] = useState<Theme>("paper");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeView, setActiveView] = useState<View>("overview");
  const [displayMode, setDisplayMode] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"create" | "device" | "preview" | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("lumaboard-theme");
    if (saved === "night") queueMicrotask(() => setTheme("night"));
    queueMicrotask(() => {
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
    window.localStorage.setItem("lumaboard-rules", JSON.stringify(next));
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
    window.localStorage.setItem("lumaboard-rules", JSON.stringify(next));
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
      } else if (/^[1-8]$/.test(event.key)) {
        const item = navItems[Number(event.key) - 1];
        if (item) setActiveView(item.id);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [refreshDevice]);

  const toggleTheme = () => {
    const next = theme === "paper" ? "night" : "paper";
    setTheme(next);
    window.localStorage.setItem("lumaboard-theme", next);
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
          </div>
          <div className="crumb">
            <span className="status-dot" />
            LumaBoard / {navItems.find((item) => item.id === activeView)?.label}
          </div>
          <div className="topbar-actions">
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
            <button className="icon-button" aria-label="Notificações">
              <Bell />
              <i className="notification-dot" />
            </button>
            <button className="icon-button" aria-label="Configurações" onClick={() => setActiveView("automation")}>
              <Settings />
            </button>
            <div className="avatar" aria-label="Perfil de Raphael">
              RS
            </div>
          </div>
        </header>

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
          onNavigate={setActiveView}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        <Check /> {toast}
      </div>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.slice(0, 5).map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeView === id ? "active" : ""} onClick={() => setActiveView(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
