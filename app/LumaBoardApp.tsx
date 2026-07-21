"use client";

import {
  BatteryMedium,
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
  Play,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  WandSparkles,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AutomationModule,
  DevicesModule,
  LibraryModule,
  PlaylistsModule,
  StudioModule,
  type View,
} from "./modules";
import { type WeatherSnapshot, useLocalWeather } from "./weather";

type Theme = "paper" | "night";

const navItems: Array<{ id: View; label: string; icon: typeof Grid2X2 }> = [
  { id: "overview", label: "Visão geral", icon: Grid2X2 },
  { id: "studio", label: "Estúdio", icon: WandSparkles },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "devices", label: "Dispositivos", icon: Monitor },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "automation", label: "Automação", icon: Zap },
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
    name: "Webhook",
    description: "Qualquer API transformada em conteúdo ambiente.",
    icon: Code2,
    tone: "moss",
  },
];

const weekDays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

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
}: {
  refreshing?: boolean;
  weather: WeatherSnapshot;
  now: Date;
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
          <span>10:00</span>
          <strong>Revisão de projeto</strong>
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
        <strong className="focus-time mono">25:00</strong>
        <span>Projeto LumaBoard</span>
        <div className="focus-ring" aria-hidden="true">
          <Play fill="currentColor" />
        </div>
        <div className="task-line">
          <Check aria-hidden="true" />
          <span>Fechar wireframes</span>
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
  children: React.ReactNode;
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
  const { weather, status: weatherStatus, refresh: refreshWeather } =
    useLocalWeather();

  const calendar = useMemo(
    () => calendarModel(now, weather.timezone),
    [now, weather.timezone],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("lumaboard-theme");
    if (saved === "night") queueMicrotask(() => setTheme("night"));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const deviceState = useMemo(
    () => ({ name: "Sala", battery: 82, synced: "há 2 min" }),
    [],
  );

  const refreshDevice = () => {
    if (refreshing) return;
    setRefreshing(true);
    setToast("Sincronizando a tela da Sala…");
    void refreshWeather();
    window.setTimeout(() => {
      setRefreshing(false);
      setToast("Tela sincronizada com sucesso.");
    }, 760);
  };

  const toggleTheme = () => {
    const next = theme === "paper" ? "night" : "paper";
    setTheme(next);
    window.localStorage.setItem("lumaboard-theme", next);
  };

  if (displayMode) {
    return (
      <div className="app-shell display-mode" data-theme={theme}>
        <button className="display-exit button secondary" onClick={() => setDisplayMode(false)}>
          <X /> Sair do modo display
        </button>
        <div className="display-canvas"><EInkPreview weather={weather} now={now} /></div>
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
            <span>{deviceState.battery}% bateria · online</span>
          </div>
          <BatteryMedium aria-hidden="true" />
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
                <Monitor /> Adicionar dispositivo
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
                <EInkPreview refreshing={refreshing} weather={weather} now={now} />
              </button>
              <footer className="preview-footer">
                <span>
                  <RefreshCw className={refreshing ? "spin" : ""} />
                  {refreshing ? "Sincronizando…" : `Atualizado ${deviceState.synced}`}
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
                    <span><span className="status-dot" /> online</span>
                  </div>
                  <MoreHorizontal />
                </header>
                <div className="device-metrics">
                  <div><BatteryMedium /><strong>{deviceState.battery}%</strong><span>bateria</span></div>
                  <div><Wifi /><strong>-54</strong><span>dBm</span></div>
                </div>
                <button className="button primary full" onClick={refreshDevice} disabled={refreshing}>
                  <RefreshCw className={refreshing ? "spin" : ""} />
                  {refreshing ? "Enviando…" : "Enviar agora"}
                </button>
              </article>

              <article className="schedule-card panel">
                <header>
                  <div>
                    <span className="eyebrow">PRÓXIMA TROCA</span>
                    <strong>Trabalho · Tarde</strong>
                  </div>
                  <span className="date-tile mono">{calendar.tile.day}<small>{calendar.tile.month}</small></span>
                </header>
                <div className="schedule-time">
                  <strong className="mono">14:00</strong>
                  <span>em 1h 24min</span>
                </div>
                <div className="progress"><i /></div>
                <button className="text-button" onClick={() => setActiveView("playlists")}>Ver agenda completa <ChevronRight /></button>
              </article>
            </div>
          </section>

          <section className="metric-grid" aria-label="Resumo operacional">
            <article className="metric panel"><span className="metric-icon"><Monitor /></span><div><strong>3</strong><span>dispositivos online</span><small>de 4 no total</small></div></article>
            <article className="metric panel"><span className="metric-icon"><ListMusic /></span><div><strong>5</strong><span>playlists ativas</span><small>2 em execução agora</small></div></article>
            <article className="metric panel"><span className="metric-icon"><CircleGauge /></span><div><strong>92%</strong><span>eficiência energética</span><small>+8% neste mês</small></div></article>
            <article className="insight panel"><span className="metric-icon"><Sparkles /></span><div><strong>Economia inteligente</strong><span>O refresh adaptativo deve render mais 23 dias de bateria.</span></div></article>
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

          {activeView === "studio" && <StudioModule preview={<EInkPreview weather={weather} now={now} />} onToast={setToast} />}
          {activeView === "playlists" && <PlaylistsModule onToast={setToast} city={weather.city} />}
          {activeView === "devices" && (
            <DevicesModule
              preview={<EInkPreview weather={weather} now={now} />}
              onToast={setToast}
              onPair={() => setModal("device")}
              onDisplay={() => setDisplayMode(true)}
            />
          )}
          {activeView === "library" && <LibraryModule onToast={setToast} />}
          {activeView === "automation" && <AutomationModule onToast={setToast} />}
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
        <Modal title="Conectar um dispositivo" onClose={() => setModal(null)}>
          <div className="pairing-flow">
            <div className="pairing-steps"><span className="active">1</span><i /><span>2</span><i /><span>3</span></div>
            <div className="pairing-copy"><span className="pair-icon"><Wifi /></span><div><h3>Digite o código exibido na tela</h3><p>Compatível com ESP32, Kindle, Kobo, navegador, Raspberry Pi e qualquer tela com URL.</p></div></div>
            <label className="field-label" htmlFor="pair-code">Código de pareamento</label>
            <input id="pair-code" className="pair-input mono" placeholder="LUMA-4821" maxLength={9} />
            <button className="button primary full" onClick={() => { setModal(null); setActiveView("devices"); setToast("Código reconhecido. Dispositivo pronto para nomear."); }}>Verificar código <ChevronRight /></button>
          </div>
        </Modal>
      )}

      {modal === "preview" && (
        <Modal title="Prévia 800 × 480" onClose={() => setModal(null)}>
          <div className="expanded-preview"><EInkPreview refreshing={refreshing} weather={weather} now={now} /><div className="expanded-actions"><span className="mono">PALETA: 4 CINZAS</span><button className="button primary" onClick={refreshDevice}><RefreshCw /> Atualizar tela</button></div></div>
        </Modal>
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
