import { fetchJsonLimited, fetchTextLimited } from "../security";

const SUMMARY_UPSTREAM_HOSTS = [
  "api.artic.edu",
  "api.bcb.gov.br",
  "api.frankfurter.dev",
  "api.jikan.moe",
  "api.open-meteo.com",
  "api.sunrise-sunset.org",
  "api.tvmaze.com",
  "air-quality-api.open-meteo.com",
  "brasilapi.com.br",
  "dev.to",
  "earthquake.usgs.gov",
  "flood-api.open-meteo.com",
  "hacker-news.firebaseio.com",
  "marine-api.open-meteo.com",
  "openlibrary.org",
  "pt.wikipedia.org",
  "servicodados.ibge.gov.br",
  "www.animenewsnetwork.com",
] as const;

export async function fetchJson(url: string, timeout = 7_000): Promise<unknown> {
  return fetchJsonLimited(url, {
    allowedHosts: SUMMARY_UPSTREAM_HOSTS,
    timeoutMs: timeout,
    noStore: true,
    maxBytes: 4_000_000,
  });
}

export async function fetchText(url: string): Promise<string> {
  return fetchTextLimited(url, {
    allowedHosts: SUMMARY_UPSTREAM_HOSTS,
    timeoutMs: 12_000,
    noStore: true,
    maxBytes: 2_000_000,
    accept: "application/rss+xml, application/xml, text/xml, text/plain",
  });
}
