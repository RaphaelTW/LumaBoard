"use client";

import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Code2,
  Columns3,
  Copy,
  Focus,
  Grid2X2,
  Library,
  ListMusic,
  Monitor,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  WandSparkles,
  X,
  Zap,
  Radio,
  Wrench,
  Palette,
  Smartphone,
  CloudDownload,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AutomationModule,
  DevicesModule,
  LibraryModule,
  PlaylistsModule,
  StudioModule,
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
import { MusicModule } from "./music-module";
import { DiagnosticsModule } from "./diagnostics-module";
import { DashboardRenderer, type DashboardRenderData } from "./dashboard-renderer";
import { createShareUrl, readDashboardState, resolveScheduledLayout } from "./dashboard-config";
import { AgendaModule } from "./agenda-module";
import { AppearanceModule } from "./appearance-module";
import { ExperienceModule } from "./experience-module";
import { APP_VERSION, usePWA } from "./pwa-manager";
import { useThemeSystem } from "./theme-system";
import { GlobalSearchDialog } from "./global-search-dialog";
import { AppSidebar, AppTopbar, NotificationQuickPanel, type ShellNavItem } from "./app-shell-components";
import { OverviewModule } from "./overview-module";
import { useActiveView } from "./use-active-view";
import { useAutomationAlerts } from "./use-automation-alerts";
import { useAvatarProfile } from "./use-avatar-profile";
import { useDashboardSync } from "./use-dashboard-sync";

const navItems: ShellNavItem[] = [
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

const weekDays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const DEFAULT_PUBLIC_PLUGINS = [...DEFAULT_PUBLIC_PLUGIN_IDS];
const navViewIds = navItems.map((item) => item.id);

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
  const { activeView, setActiveView } = useActiveView(navViewIds);
  const [displayMode, setDisplayMode] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"create" | "device" | "preview" | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const { dashboardState, musicCache } = useDashboardSync();
  const { avatarInitials, updateAvatarInitials } = useAvatarProfile(setToast);
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
  const { rainEvaluation, updateRainRule, clearRainHistory } = useAutomationAlerts({
    weather,
    weatherStatus,
    now,
    onToast: setToast,
    onNavigate: setActiveView,
  });

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
  }, [setActiveView]);

  useEffect(() => {
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

  useEffect(() => {
    const reconnect = () => refreshDevice();
    window.addEventListener("lumaboard:reconnect", reconnect);
    return () => window.removeEventListener("lumaboard:reconnect", reconnect);
  }, [refreshDevice, setActiveView]);

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
  }, [refreshDevice, setActiveView]);

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

      <AppSidebar
        navItems={navItems}
        activeView={activeView}
        appVersion={APP_VERSION}
        deviceName={deviceState.name}
        onNavigate={setActiveView}
      />

      <div className="content-shell">
        <AppTopbar
          navItems={navItems}
          activeView={activeView}
          appVersion={APP_VERSION}
          online={pwa.online}
          statusText={pwa.statusText}
          theme={theme}
          notificationCount={notificationCount}
          notificationPanelOpen={notificationPanelOpen}
          avatarInitials={avatarInitials}
          onNavigate={setActiveView}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleTheme={toggleTheme}
          onToggleNotifications={() => setNotificationPanelOpen((open) => !open)}
        />

        {notificationPanelOpen && (
          <NotificationQuickPanel
            notificationCount={notificationCount}
            unreadInbox={localWidgets.notificationInbox.filter((item) => !item.readAt)}
            overdueCount={localWidgets.overdueTasks.length}
            updateAvailable={pwa.updateAvailable}
            publicDataError={publicDataStatus === "error"}
            weatherError={weatherStatus === "error"}
            online={pwa.online}
            notificationPermission={localWidgets.notificationPermission}
            unreadCount={localWidgets.unreadNotificationCount}
            onClose={() => setNotificationPanelOpen(false)}
            onNavigate={setActiveView}
            onMarkNotificationRead={localWidgets.markNotificationRead}
            onMarkAllNotificationsRead={localWidgets.markAllNotificationsRead}
            onRequestNotifications={() => {
              void localWidgets.requestNotifications().then((permission) => {
                setToast(permission === "granted" ? "Notificações locais ativadas." : "Permissão de notificações não concedida.");
              });
            }}
          />
        )}

        {pwa.updateAvailable && <div className="global-update-banner"><CloudDownload /><span><strong>Atualização disponível</strong> Uma cópia local será criada antes de recarregar.</span><button onClick={pwa.applyUpdate}>Atualizar agora</button></div>}
        <main id="conteudo" className={`dashboard ${activeView !== "overview" ? "module-dashboard" : ""}`}>
          <div hidden={activeView !== "overview"}>
          <OverviewModule
            preview={<EInkPreview refreshing={refreshing} weather={weather} now={now} event={previewEvent} focus={previewFocus} />}
            refreshing={refreshing}
            weatherStatus={weatherStatus}
            deviceState={deviceState}
            calendarTile={calendar.tile}
            localWidgets={localWidgets}
            publicSummary={publicSummary}
            publicDataStatus={publicDataStatus}
            enabledPublicPlugins={enabledPublicPlugins}
            onCreateScreen={() => setModal("create")}
            onCreateDisplayLink={() => setModal("device")}
            onOpenPreview={() => setModal("preview")}
            onRefreshDevice={refreshDevice}
            onRefreshPublicData={() => void refreshPublicData()}
            onUseLocation={setManualLocation}
            onUseMachineLocation={() => refreshWeather(true)}
            onToast={setToast}
            onNavigate={setActiveView}
          />

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
