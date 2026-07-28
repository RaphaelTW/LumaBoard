import { fetchJson } from "./fetch-json";
import type { NewsItem } from "./summary-types";
import { isRecord, safeHttpUrl, stringOrNull, toIsoDate } from "./utils";

async function loadHackerNews(): Promise<NewsItem[]> {
  const idsPayload = await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json");
  if (!Array.isArray(idsPayload)) throw new Error("Lista de notícias inválida");
  const ids = idsPayload.slice(0, 8).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const stories = await Promise.allSettled(ids.map((id) => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));
  return stories
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .filter(isRecord)
    .map((story): NewsItem | null => {
      const id = Number(story.id);
      const title = typeof story.title === "string" ? story.title.trim() : "";
      if (!Number.isInteger(id) || !title) return null;
      const originalUrl = safeHttpUrl(story.url) ?? "";
      let source = "Hacker News";
      if (originalUrl) {
        try {
          source = new URL(originalUrl).hostname.replace(/^www\./, "");
        } catch {
          // Keep the provider label.
        }
      }
      const timestamp = Number(story.time);
      return {
        id: `hn-${id}`,
        title,
        url: originalUrl || `https://news.ycombinator.com/item?id=${id}`,
        score: Math.max(0, Number(story.score) || 0),
        source,
        publishedAt: Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : null,
        imageUrl: null,
      };
    })
    .filter((item): item is NewsItem => item !== null)
    .slice(0, 6);
}

async function loadDevNews(): Promise<NewsItem[]> {
  const payload = await fetchJson("https://dev.to/api/articles?top=7&per_page=6");
  if (!Array.isArray(payload)) throw new Error("DEV Community indisponível");
  return payload.filter(isRecord).flatMap((article): NewsItem[] => {
    const id = Number(article.id);
    const title = stringOrNull(article.title);
    const url = safeHttpUrl(article.url, ["dev.to"]);
    if (!Number.isInteger(id) || !title || !url) return [];
    return [{
      id: `dev-${id}`,
      title,
      url,
      score: Math.max(0, Number(article.public_reactions_count) || 0),
      source: "DEV Community",
      publishedAt: toIsoDate(article.published_at),
      imageUrl: safeHttpUrl(article.cover_image, ["media.dev.to", "*.dev.to"]) ?? safeHttpUrl(article.social_image, ["media.dev.to", "*.dev.to"]),
    }];
  });
}

export async function loadNews(): Promise<NewsItem[]> {
  const [hackerNews, devNews] = await Promise.allSettled([loadHackerNews(), loadDevNews()]);
  const combined = [
    ...(hackerNews.status === "fulfilled" ? hackerNews.value : []),
    ...(devNews.status === "fulfilled" ? devNews.value : []),
  ];
  if (combined.length === 0) throw new Error("Notícias de tecnologia indisponíveis");
  return combined
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.score - a.score)
    .slice(0, 10);
}
