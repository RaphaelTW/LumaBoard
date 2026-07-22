"use client";

import {
  BookOpen,
  ExternalLink,
  LocateFixed,
  MapPin,
  Search,
  Soup,
  Tv,
  Globe2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { isRecord, readStoredValue, writeStoredValue } from "./storage";

const EXPLORER_KEY = "lumaboard-public-explorer-v1";

type SearchType = "location" | "book" | "wikipedia" | "tv" | "food";
type SearchResult = Record<string, unknown>;
type SearchResponse = {
  type: SearchType;
  query: string;
  updatedAt: string;
  results: SearchResult[];
};

type ExplorerCache = {
  type: SearchType;
  queries: Partial<Record<SearchType, string>>;
  responses: Partial<Record<SearchType, SearchResponse>>;
};

type ManualLocationInput = {
  latitude: number;
  longitude: number;
  city: string;
  state?: string;
  stateCode?: string;
  countryCode?: string;
  timezone?: string;
};

const tabs: Array<{
  id: SearchType;
  label: string;
  placeholder: string;
  icon: typeof Search;
}> = [
  { id: "location", label: "Locais", placeholder: "Ex.: Curitiba, Paraná", icon: MapPin },
  { id: "book", label: "Livros", placeholder: "Título, autor ou assunto", icon: BookOpen },
  { id: "wikipedia", label: "Wikipédia", placeholder: "Assunto para pesquisar", icon: Globe2 },
  { id: "tv", label: "Séries", placeholder: "Nome de uma série", icon: Tv },
  { id: "food", label: "Alimentos", placeholder: "Código de barras", icon: Soup },
];

const emptyCache: ExplorerCache = {
  type: "location",
  queries: {},
  responses: {},
};

function isSearchType(value: unknown): value is SearchType {
  return value === "location" || value === "book" || value === "wikipedia" || value === "tv" || value === "food";
}

function isSearchResponse(value: unknown): value is SearchResponse {
  return (
    isRecord(value) &&
    isSearchType(value.type) &&
    typeof value.query === "string" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.results) &&
    value.results.every(isRecord)
  );
}

function isExplorerCache(value: unknown): value is ExplorerCache {
  if (!isRecord(value) || !isSearchType(value.type) || !isRecord(value.queries) || !isRecord(value.responses)) {
    return false;
  }
  return Object.values(value.responses).every((item) => item === undefined || isSearchResponse(item));
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number | null {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function formatNumber(value: unknown, suffix = ""): string {
  const result = number(value);
  return result === null ? "—" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(result)}${suffix}`;
}

function resultLink(item: SearchResult): string {
  const url = text(item.url);
  return /^https:\/\//.test(url) ? url : "";
}

function ResultCard({
  type,
  item,
  onUseLocation,
}: {
  type: SearchType;
  item: SearchResult;
  onUseLocation: (input: ManualLocationInput) => Promise<boolean>;
}) {
  const [applying, setApplying] = useState(false);
  const url = resultLink(item);

  if (type === "location") {
    const latitude = number(item.latitude);
    const longitude = number(item.longitude);
    const apply = async () => {
      if (latitude === null || longitude === null) return;
      setApplying(true);
      try {
        await onUseLocation({
          latitude,
          longitude,
          city: text(item.city) || text(item.label),
          state: text(item.state),
          stateCode: text(item.stateCode),
          countryCode: text(item.countryCode) || "BR",
          timezone: text(item.timezone),
        });
      } finally {
        setApplying(false);
      }
    };
    return (
      <article className="explorer-result-card">
        <div>
          <strong>{text(item.label) || "Local encontrado"}</strong>
          <span>{formatNumber(latitude, "°")} · {formatNumber(longitude, "°")}</span>
          <small>{text(item.source)}</small>
        </div>
        <button className="button secondary" onClick={() => void apply()} disabled={applying}>
          <LocateFixed /> {applying ? "Aplicando…" : "Usar no painel"}
        </button>
      </article>
    );
  }

  if (type === "food") {
    return (
      <article className="explorer-result-card">
        <div>
          <strong>{text(item.title)}</strong>
          <span>{text(item.brands) || "Marca não informada"}</span>
          <small>
            Nutri-Score {text(item.nutriScore) || "—"} · {formatNumber(item.caloriesKcal100g, " kcal/100g")} · açúcares {formatNumber(item.sugars100g, " g")}
          </small>
        </div>
        {url && <a className="button secondary" href={url} target="_blank" rel="noreferrer">Abrir <ExternalLink /></a>}
      </article>
    );
  }

  const title = text(item.title) || text(item.show) || "Resultado";
  const description =
    text(item.author) ||
    text(item.description) ||
    text(item.network) ||
    text(item.summary) ||
    text(item.excerpt);
  const detail =
    type === "book"
      ? [item.year ? String(item.year) : "", item.editions ? `${item.editions} edições` : ""].filter(Boolean).join(" · ")
      : type === "tv"
        ? [text(item.language), Array.isArray(item.genres) ? item.genres.join(", ") : "", text(item.status)].filter(Boolean).join(" · ")
        : text(item.excerpt);

  return (
    <article className="explorer-result-card">
      <div>
        <strong>{title}</strong>
        <span>{description || "Informação pública"}</span>
        {detail && <small>{detail}</small>}
      </div>
      {url && <a className="button secondary" href={url} target="_blank" rel="noreferrer">Abrir <ExternalLink /></a>}
    </article>
  );
}

export function PublicExplorer({
  onUseLocation,
  onUseMachineLocation,
  onToast,
}: {
  onUseLocation: (input: ManualLocationInput) => Promise<boolean>;
  onUseMachineLocation: () => Promise<void> | void;
  onToast: (message: string) => void;
}) {
  const [cache, setCache] = useState<ExplorerCache>(emptyCache);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = readStoredValue<ExplorerCache>(EXPLORER_KEY, isExplorerCache, emptyCache);
    queueMicrotask(() => {
      setCache(saved);
      setQuery(saved.queries[saved.type] ?? "");
    });
  }, []);

  const activeTab = tabs.find((tab) => tab.id === cache.type) ?? tabs[0];
  const response = cache.responses[cache.type] ?? null;
  const results = useMemo(() => response?.results ?? [], [response]);

  const persist = (next: ExplorerCache) => {
    setCache(next);
    writeStoredValue(EXPLORER_KEY, next);
  };

  const selectType = (type: SearchType) => {
    const next = { ...cache, type };
    persist(next);
    setQuery(next.queries[type] ?? "");
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setError("Digite pelo menos dois caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/public/search", window.location.origin);
      url.searchParams.set("type", cache.type);
      url.searchParams.set("q", cleanQuery);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const payload: unknown = await response.json();
      if (!response.ok || !isSearchResponse(payload)) {
        const message = isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : "Consulta pública indisponível.";
        throw new Error(message);
      }
      const next: ExplorerCache = {
        type: cache.type,
        queries: { ...cache.queries, [cache.type]: cleanQuery },
        responses: { ...cache.responses, [cache.type]: payload },
      };
      persist(next);
      onToast(`${payload.results.length} resultado(s) salvo(s) no cache local.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Consulta pública indisponível.");
    } finally {
      setLoading(false);
    }
  };

  const useLocation = async (input: ManualLocationInput) => {
    const success = await onUseLocation(input);
    onToast(success ? "Local aplicado e salvo neste navegador." : "Não foi possível aplicar o local.");
    return success;
  };

  return (
    <section className="public-explorer-section">
      <header className="section-heading">
        <div>
          <span className="eyebrow">CONSULTAS SOB DEMANDA</span>
          <h2>Pesquise sem conta e sem chave.</h2>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => void onUseMachineLocation()}><LocateFixed /> Usar localização da máquina</button>
          <span className="status-chip">CACHE LOCAL</span>
        </div>
      </header>

      <article className="panel public-explorer-panel">
        <div className="explorer-tabs" role="tablist" aria-label="Fontes de pesquisa pública">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={cache.type === id}
              className={cache.type === id ? "active" : ""}
              onClick={() => selectType(id)}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        <form className="explorer-search" onSubmit={submit}>
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeTab.placeholder}
              inputMode={cache.type === "food" ? "numeric" : "search"}
              aria-label={`Pesquisar ${activeTab.label}`}
            />
          </label>
          <button className="button primary" disabled={loading}>
            <Search /> {loading ? "Consultando…" : "Pesquisar"}
          </button>
        </form>

        {error && <p className="explorer-error">{error}</p>}
        <div className="explorer-results">
          {!loading && response && results.length === 0 && (
            <p className="explorer-empty">Nenhum resultado encontrado para “{response.query}”.</p>
          )}
          {results.map((item, index) => (
            <ResultCard
              key={`${text(item.id) || text(item.title) || "result"}-${index}`}
              type={cache.type}
              item={item}
              onUseLocation={useLocation}
            />
          ))}
          {!response && !loading && (
            <p className="explorer-empty">A pesquisa só chama a API quando você envia o formulário. O último resultado fica no localStorage.</p>
          )}
        </div>

        <footer className="public-data-footer">
          <span>Open-Meteo Geocoding · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Open Library · Wikimedia · TVmaze · Open Food Facts</span>
          <span>Nenhuma consulta é gravada no servidor.</span>
        </footer>
      </article>
    </section>
  );
}
