"use client";

import {
  Activity,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code2,
  DollarSign,
  Droplets,
  ExternalLink,
  EyeOff,
  Landmark,
  Library,
  MapPin,
  Mountain,
  Newspaper,
  Palette,
  RefreshCw,
  Sparkles,
  Sunrise,
  Tv,
  Waves,
  Wind,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { describeAqi, type PublicAnimeItem, type PublicNewsItem, type PublicSummary } from "./public-data";
import { writeStoredValue } from "./storage";

function formatPublicDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
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
    writeStoredValue("lumaboard-news-preferences-v1", all);
  } catch {
    writeStoredValue("lumaboard-news-preferences-v1", { [label]: value });
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
  const [preferences, setPreferences] = useState<NewsPreferences>({ source: "all", intervalSeconds: 8, imageOnly: false, savedOnly: false });
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
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % visibleItems.length), preferences.intervalSeconds * 1000);
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
    writeStoredValue("lumaboard-news-state-v1", next);
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

export function PublicDataPanel({
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
  const artwork = summary.content.artwork;
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
        {enabled.includes("art") && <article className="panel public-data-card news-card"><span className="metric-icon"><Palette /></span><div><span>Obra pública do dia</span><strong>{artwork?.title ?? "Obra indisponível"}</strong>{artwork && <a href={artwork.url} target="_blank" rel="noreferrer">{artwork.artist}{artwork.date ? ` · ${artwork.date}` : ""} · {artwork.source} <ExternalLink /></a>}</div></article>}
        {enabled.includes("books") && <article className="panel public-data-card news-card"><span className="metric-icon"><BookOpen /></span><div><span>Livro em destaque</span><strong>{book?.title ?? "Livro indisponível"}</strong>{book && <a href={book.url} target="_blank" rel="noreferrer">{book.author}{book.year ? ` · ${book.year}` : ""} <ExternalLink /></a>}</div></article>}
        {enabled.includes("wikipedia") && <article className="panel public-data-card news-card"><span className="metric-icon"><Code2 /></span><div><span>Wikipédia</span><strong>{wikipedia?.title ?? "Artigo indisponível"}</strong>{wikipedia && <a href={wikipedia.url} target="_blank" rel="noreferrer">{wikipedia.description || wikipedia.excerpt || "Abrir artigo"} <ExternalLink /></a>}</div></article>}
        {enabled.includes("tv") && <article className="panel public-data-card news-card"><span className="metric-icon"><Tv /></span><div><span>TV e streaming hoje</span><strong>{tv?.show ?? "Sem programação brasileira encontrada"}</strong>{tv && <a href={tv.url} target="_blank" rel="noreferrer">{tv.episode} · {tv.time ?? "horário variável"} · {tv.network} <ExternalLink /></a>}</div></article>}
        {enabled.length === 0 && <article className="panel public-data-card empty-public-card"><span className="metric-icon"><Library /></span><div><span>Fontes opcionais ocultas</span><strong>Abra a Biblioteca</strong><small>Ative as fontes públicas que deseja exibir.</small></div></article>}
      </div>
      <footer className="public-data-footer"><span>{status === "ready" ? "Dados atualizados" : status === "stale" ? "Usando cache local" : status === "error" ? "APIs temporariamente indisponíveis" : "Conectando às APIs"}{summary.warnings.length ? ` · ${summary.warnings.length} fonte(s) com falha` : ""}</span><span>Cache local + Function sem estado · {summary.sources.length} provedores · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / CAMS / <a href="https://www.dwd.de/" target="_blank" rel="noreferrer">DWD</a></span></footer>
    </section>
  );
}
