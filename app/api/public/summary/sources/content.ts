import { APP_USER_AGENT } from "../../../../app-version";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchJson(url: string, timeout = 7000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": APP_USER_AGENT,
      },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function localDateKey(timeZone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function loadFeaturedBook() {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", "subject:technology");
  url.searchParams.set("limit", "5");
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i");
  const payload = await fetchJson(url.toString());
  const docs = isRecord(payload) && Array.isArray(payload.docs) ? payload.docs.filter(isRecord) : [];
  if (docs.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86_400_000) % docs.length;
  const book = docs[dayIndex];
  const key = stringOrNull(book.key);
  const coverId = finiteOrNull(book.cover_i);
  return {
    title: stringOrNull(book.title) ?? "Livro sem título",
    author: Array.isArray(book.author_name) && typeof book.author_name[0] === "string" ? book.author_name[0] : "Autor não informado",
    year: finiteOrNull(book.first_publish_year),
    url: key ? `https://openlibrary.org${key}` : "https://openlibrary.org/",
    coverUrl: coverId === null ? null : `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
  };
}

export async function loadArtwork() {
  const page = Math.max(1, (new Date().getUTCDate() % 12) + 1);
  const url = new URL("https://api.artic.edu/api/v1/artworks/search");
  url.searchParams.set("query[term][is_public_domain]", "true");
  url.searchParams.set("fields", "id,title,artist_display,date_display,image_id");
  url.searchParams.set("limit", "1");
  url.searchParams.set("page", String(page));
  const payload = await fetchJson(url.toString());
  const items = isRecord(payload) && Array.isArray(payload.data) ? payload.data.filter(isRecord) : [];
  const item = items[0];
  if (!item) return null;
  const id = finiteOrNull(item.id);
  const imageId = stringOrNull(item.image_id);
  return {
    title: stringOrNull(item.title) ?? "Obra sem título",
    artist: stringOrNull(item.artist_display) ?? "Artista não informado",
    date: stringOrNull(item.date_display),
    url: id === null ? "https://www.artic.edu/collection" : `https://www.artic.edu/artworks/${id}`,
    imageUrl: imageId ? `https://www.artic.edu/iiif/2/${imageId}/full/843,/0/default.jpg` : null,
    source: "Art Institute of Chicago",
  };
}

export async function loadWikipedia() {
  const topics = ["ciência", "tecnologia", "Brasil", "natureza", "história", "astronomia"];
  const topic = topics[Math.floor(Date.now() / 86_400_000) % topics.length];
  const url = new URL("https://pt.wikipedia.org/w/rest.php/v1/search/page");
  url.searchParams.set("q", topic);
  url.searchParams.set("limit", "1");
  const payload = await fetchJson(url.toString());
  const pages = isRecord(payload) && Array.isArray(payload.pages) ? payload.pages.filter(isRecord) : [];
  const page = pages[0];
  if (!page) return null;
  const title = stringOrNull(page.title) ?? topic;
  const thumbnail = isRecord(page.thumbnail) ? page.thumbnail : {};
  return {
    title,
    description: stringOrNull(page.description) ?? "Artigo da Wikipédia",
    excerpt: stripHtml(stringOrNull(page.excerpt) ?? ""),
    url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    thumbnailUrl: stringOrNull(thumbnail.url),
  };
}

function parseTvItem(value: unknown) {
  if (!isRecord(value)) return null;
  const show = isRecord(value.show) ? value.show : {};
  const webChannel = isRecord(show.webChannel) ? show.webChannel : {};
  const network = isRecord(show.network) ? show.network : {};
  const showName = stringOrNull(show.name);
  if (!showName) return null;
  return {
    show: showName,
    episode: stringOrNull(value.name) ?? "Episódio sem título",
    date: stringOrNull(value.airdate),
    time: stringOrNull(value.airtime),
    url: stringOrNull(value.url) ?? stringOrNull(show.url) ?? "https://www.tvmaze.com/",
    network: stringOrNull(webChannel.name) ?? stringOrNull(network.name) ?? "Streaming / TV",
  };
}

export async function loadTv() {
  const date = localDateKey();
  const webUrl = new URL("https://api.tvmaze.com/schedule/web");
  webUrl.searchParams.set("country", "BR");
  webUrl.searchParams.set("date", date);
  const webPayload = await fetchJson(webUrl.toString());
  const webItems = Array.isArray(webPayload) ? webPayload : [];
  const firstWeb = webItems.map(parseTvItem).find((item) => item !== null);
  if (firstWeb) return firstWeb;

  const regularUrl = new URL("https://api.tvmaze.com/schedule");
  regularUrl.searchParams.set("country", "BR");
  regularUrl.searchParams.set("date", date);
  const regularPayload = await fetchJson(regularUrl.toString());
  const regularItems = Array.isArray(regularPayload) ? regularPayload : [];
  return regularItems.map(parseTvItem).find((item) => item !== null) ?? null;
}
