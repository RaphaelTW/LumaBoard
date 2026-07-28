import { fetchJson, fetchText } from "./fetch-json";
import type { AnimeItem, NewsItem } from "./summary-types";
import { finiteOrNull, isRecord, safeHttpUrl, stringOrNull, toIsoDate } from "./utils";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (entity, code: string) => {
      const point = Number(code);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    })
    .replace(/&#x([0-9a-f]+);/gi, (entity, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    })
    .replace(/<[^>]+>/g, "")
    .trim();
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function xmlAttribute(block: string, tag: string, attribute: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

async function loadAnimeNews(): Promise<NewsItem[]> {
  const xml = await fetchText("https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us");
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const parsed = items.flatMap((block, index): NewsItem[] => {
    const title = xmlTag(block, "title");
    const url = safeHttpUrl(xmlTag(block, "link"));
    if (!title || !url) return [];
    const guid = xmlTag(block, "guid") || `${index}-${url}`;
    const imageUrl = safeHttpUrl(xmlAttribute(block, "media:thumbnail", "url") || xmlAttribute(block, "media:content", "url") || xmlAttribute(block, "enclosure", "url"));
    return [{
      id: `ann-${guid}`,
      title,
      url,
      score: 0,
      source: "Anime News Network",
      publishedAt: toIsoDate(xmlTag(block, "pubDate")),
      imageUrl,
    }];
  });
  if (parsed.length === 0) throw new Error("RSS de anime indisponível");
  return parsed.slice(0, 12);
}

async function loadTrendingAnime(): Promise<AnimeItem[]> {
  const payload = await fetchJson("https://api.jikan.moe/v4/top/anime?filter=airing&limit=8");
  const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  const items = data.filter(isRecord).flatMap((anime): AnimeItem[] => {
    const id = Number(anime.mal_id);
    const title = stringOrNull(anime.title_english) ?? stringOrNull(anime.title);
    const url = safeHttpUrl(anime.url);
    if (!Number.isInteger(id) || !title || !url) return [];
    const images = isRecord(anime.images) ? anime.images : {};
    const jpg = isRecord(images.jpg) ? images.jpg : {};
    const episodes = finiteOrNull(anime.episodes);
    const type = stringOrNull(anime.type) ?? "Anime";
    return [{
      id,
      title,
      url,
      score: finiteOrNull(anime.score),
      imageUrl: safeHttpUrl(jpg.large_image_url) ?? safeHttpUrl(jpg.image_url),
      detail: `${type}${episodes === null ? "" : ` · ${Math.round(episodes)} episódios`}`,
    }];
  });
  if (items.length === 0) throw new Error("Jikan sem títulos em exibição");
  return items;
}

export async function loadAnime() {
  const [news, trending] = await Promise.allSettled([loadAnimeNews(), loadTrendingAnime()]);
  if (news.status === "rejected" && trending.status === "rejected") throw new Error("Fontes de anime indisponíveis");
  return {
    news: news.status === "fulfilled" ? news.value : [],
    trending: trending.status === "fulfilled" ? trending.value : [],
  };
}
