import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
type SearchType = "location" | "book" | "wikipedia" | "tv" | "anime" | "food";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeHttpUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const BRAZIL_STATE_CODES: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

function normalizedKey(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function brazilStateCode(state: unknown, countryCode: unknown): string {
  if (text(countryCode).toUpperCase() !== "BR") return "";
  return BRAZIL_STATE_CODES[normalizedKey(state)] ?? "";
}

async function fetchJson(url: string, timeout = 9000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "LumaBoard/1.5 (+https://lumaboard.netlify.app)",
      },
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchLocations(query: string) {
  const openMeteoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  openMeteoUrl.searchParams.set("name", query);
  openMeteoUrl.searchParams.set("count", "8");
  openMeteoUrl.searchParams.set("language", "pt");
  openMeteoUrl.searchParams.set("format", "json");

  const openMeteoPayload = await fetchJson(openMeteoUrl.toString()).catch(() => null);
  const openMeteoRecord = isRecord(openMeteoPayload) ? openMeteoPayload : {};
  const openMeteoItems = Array.isArray(openMeteoRecord.results)
    ? openMeteoRecord.results.filter(isRecord)
    : [];

  const primary = openMeteoItems
    .map((item) => ({
      id: `open-meteo-${item.id ?? `${item.latitude}-${item.longitude}`}`,
      label: [text(item.name), text(item.admin1), text(item.country)].filter(Boolean).join(", "),
      city: text(item.name),
      state: text(item.admin1),
      stateCode:
        text(item.admin1_code).replace(/^BR-/, "") ||
        brazilStateCode(item.admin1, item.country_code),
      country: text(item.country),
      countryCode: text(item.country_code).toUpperCase(),
      latitude: numberOrNull(item.latitude),
      longitude: numberOrNull(item.longitude),
      timezone: text(item.timezone),
      source: "Open-Meteo Geocoding",
    }))
    .filter((item) => item.latitude !== null && item.longitude !== null && item.label);

  // Nominatim is a fallback only. This keeps usage low and respects the public
  // service policy while still providing a second source for difficult searches.
  let fallback: Array<{
    id: string;
    label: string;
    city: string;
    state: string;
    stateCode: string;
    country: string;
    countryCode: string;
    latitude: number | null;
    longitude: number | null;
    timezone: string;
    source: string;
  }> = [];

  if (primary.length === 0) {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", query);
    nominatimUrl.searchParams.set("format", "jsonv2");
    nominatimUrl.searchParams.set("limit", "5");
    nominatimUrl.searchParams.set("addressdetails", "1");

    const nominatimPayload = await fetchJson(nominatimUrl.toString()).catch(() => []);
    const nominatimItems = Array.isArray(nominatimPayload)
      ? nominatimPayload.filter(isRecord)
      : [];
    fallback = nominatimItems
      .map((item) => {
        const address = isRecord(item.address) ? item.address : {};
        return {
          id: `osm-${text(item.place_id) || `${item.lat}-${item.lon}`}`,
          label: text(item.display_name),
          city:
            text(address.city) ||
            text(address.town) ||
            text(address.municipality) ||
            text(address.village),
          state: text(address.state),
          stateCode: text(address["ISO3166-2-lvl4"]).replace(/^[A-Z]{2}-/, ""),
          country: text(address.country),
          countryCode: text(address.country_code).toUpperCase(),
          latitude: numberOrNull(item.lat),
          longitude: numberOrNull(item.lon),
          timezone: "",
          source: "OpenStreetMap Nominatim",
        };
      })
      .filter((item) => item.latitude !== null && item.longitude !== null && item.label);
  }

  const seen = new Set<string>();
  return [...primary, ...fallback].filter((item) => {
    const key = `${item.latitude?.toFixed(3)}:${item.longitude?.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

async function searchBooks(query: string) {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,edition_count");
  const payload = await fetchJson(url.toString());
  const docs = isRecord(payload) && Array.isArray(payload.docs) ? payload.docs.filter(isRecord) : [];
  return docs.map((item) => {
    const key = text(item.key);
    const coverId = numberOrNull(item.cover_i);
    return {
      id: key || text(item.title),
      title: text(item.title) || "Livro sem título",
      author:
        Array.isArray(item.author_name) && typeof item.author_name[0] === "string"
          ? item.author_name[0]
          : "Autor não informado",
      year: numberOrNull(item.first_publish_year),
      editions: numberOrNull(item.edition_count),
      url: key ? `https://openlibrary.org${key}` : "https://openlibrary.org/",
      coverUrl: coverId === null ? null : `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
      source: "Open Library",
    };
  });
}

async function searchWikipedia(query: string) {
  const url = new URL("https://pt.wikipedia.org/w/rest.php/v1/search/page");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  const payload = await fetchJson(url.toString());
  const pages = isRecord(payload) && Array.isArray(payload.pages) ? payload.pages.filter(isRecord) : [];
  return pages.map((item) => {
    const title = text(item.title) || query;
    const thumbnail = isRecord(item.thumbnail) ? item.thumbnail : {};
    return {
      id: text(item.id) || title,
      title,
      description: text(item.description),
      excerpt: stripHtml(text(item.excerpt)),
      url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      thumbnailUrl: text(thumbnail.url) || null,
      source: "Wikipédia",
    };
  });
}

async function searchTv(query: string) {
  const url = new URL("https://api.tvmaze.com/search/shows");
  url.searchParams.set("q", query);
  const payload = await fetchJson(url.toString());
  const items = Array.isArray(payload) ? payload.filter(isRecord) : [];
  return items.slice(0, 8).flatMap((entry) => {
    const show = isRecord(entry.show) ? entry.show : {};
    const image = isRecord(show.image) ? show.image : {};
    const network = isRecord(show.network) ? show.network : {};
    const webChannel = isRecord(show.webChannel) ? show.webChannel : {};
    const title = text(show.name);
    if (!title) return [];
    return [{
      id: String(show.id ?? title),
      title,
      language: text(show.language),
      genres: Array.isArray(show.genres) ? show.genres.filter((item): item is string => typeof item === "string") : [],
      status: text(show.status),
      network: text(network.name) || text(webChannel.name) || "",
      summary: stripHtml(text(show.summary)),
      url: text(show.url) || "https://www.tvmaze.com/",
      imageUrl: text(image.medium) || null,
      source: "TVmaze",
    }];
  });
}


async function searchAnime(query: string) {
  const url = new URL("https://api.jikan.moe/v4/anime");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("sfw", "true");
  const payload = await fetchJson(url.toString());
  const items = isRecord(payload) && Array.isArray(payload.data) ? payload.data.filter(isRecord) : [];
  return items.flatMap((anime) => {
    const id = numberOrNull(anime.mal_id);
    const title = text(anime.title_english) || text(anime.title);
    const url = safeHttpUrl(anime.url);
    if (id === null || !title || !url) return [];
    const images = isRecord(anime.images) ? anime.images : {};
    const jpg = isRecord(images.jpg) ? images.jpg : {};
    return [{
      id: String(Math.round(id)),
      title,
      originalTitle: text(anime.title_japanese),
      type: text(anime.type),
      episodes: numberOrNull(anime.episodes),
      status: text(anime.status),
      score: numberOrNull(anime.score),
      year: numberOrNull(anime.year),
      synopsis: stripHtml(text(anime.synopsis)),
      url,
      imageUrl: safeHttpUrl(jpg.large_image_url) ?? safeHttpUrl(jpg.image_url),
      source: "Jikan / MyAnimeList",
    }];
  });
}

async function searchFood(barcode: string) {
  const url = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${barcode}.json`);
  url.searchParams.set("cc", "br");
  url.searchParams.set("lc", "pt");
  url.searchParams.set(
    "fields",
    "code,product_name,brands,nutriscore_grade,nova_group,ecoscore_grade,image_front_small_url,nutriments,ingredients_text,allergens",
  );
  let payload: unknown;
  try {
    payload = await fetchJson(url.toString());
  } catch (cause) {
    if (cause instanceof Error && cause.message === "HTTP 404") return [];
    throw cause;
  }
  const record = isRecord(payload) ? payload : {};
  const product = isRecord(record.product) ? record.product : {};
  if (Object.keys(product).length === 0) return [];
  const nutriments = isRecord(product.nutriments) ? product.nutriments : {};
  return [{
    id: text(product.code) || barcode,
    barcode,
    title: text(product.product_name) || "Produto sem nome",
    brands: text(product.brands),
    nutriScore: text(product.nutriscore_grade).toUpperCase() || null,
    novaGroup: numberOrNull(product.nova_group),
    ecoScore: text(product.ecoscore_grade).toUpperCase() || null,
    caloriesKcal100g: numberOrNull(nutriments["energy-kcal_100g"]),
    sugars100g: numberOrNull(nutriments.sugars_100g),
    proteins100g: numberOrNull(nutriments.proteins_100g),
    ingredients: text(product.ingredients_text),
    allergens: text(product.allergens),
    imageUrl: text(product.image_front_small_url) || null,
    url: `https://world.openfoodfacts.org/product/${barcode}`,
    source: "Open Food Facts",
  }];
}

function parseType(value: string | null): SearchType | null {
  return value === "location" ||
    value === "book" ||
    value === "wikipedia" ||
    value === "tv" ||
    value === "anime" ||
    value === "food"
    ? value
    : null;
}

export async function GET(request: NextRequest) {
  const type = parseType(request.nextUrl.searchParams.get("type"));
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!type) {
    return NextResponse.json({ error: "Tipo de consulta inválido" }, { status: 400 });
  }
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ error: "Informe uma consulta entre 2 e 100 caracteres" }, { status: 400 });
  }
  if (type === "food" && !/^\d{8,14}$/.test(query.replace(/\D/g, ""))) {
    return NextResponse.json({ error: "Informe um código de barras entre 8 e 14 dígitos" }, { status: 400 });
  }

  try {
    const normalizedQuery = type === "food" ? query.replace(/\D/g, "") : query;
    const results =
      type === "location"
        ? await searchLocations(normalizedQuery)
        : type === "book"
          ? await searchBooks(normalizedQuery)
          : type === "wikipedia"
            ? await searchWikipedia(normalizedQuery)
            : type === "tv"
              ? await searchTv(normalizedQuery)
              : type === "anime"
                ? await searchAnime(normalizedQuery)
                : await searchFood(normalizedQuery);

    return NextResponse.json(
      { type, query: normalizedQuery, updatedAt: new Date().toISOString(), results },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=86400, stale-while-revalidate=604800",
          "X-LumaBoard-Storage": "stateless",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "A fonte pública não respondeu. Tente novamente mais tarde." },
      { status: 502 },
    );
  }
}
