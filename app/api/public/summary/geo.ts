import { fetchJson } from "./fetch-json";
import type { EarthquakeItem, JsonRecord } from "./summary-types";
import { finiteOrNull, isRecord, normalizeText, readNestedRecord, stringOrNull } from "./utils";

function latestSeriesValue(payload: unknown): { value: number | null; year: string | null } {
  if (!Array.isArray(payload)) return { value: null, year: null };
  for (const variable of payload) {
    if (!isRecord(variable) || !Array.isArray(variable.resultados)) continue;
    for (const result of variable.resultados) {
      if (!isRecord(result) || !Array.isArray(result.series)) continue;
      for (const series of result.series) {
        if (!isRecord(series) || !isRecord(series.serie)) continue;
        const entries = Object.entries(series.serie).sort(([a], [b]) => a.localeCompare(b));
        const last = entries.at(-1);
        if (!last) continue;
        return { year: last[0], value: finiteOrNull(last[1]) };
      }
    }
  }
  return { value: null, year: null };
}

export async function loadIbge(city: string, stateCode: string) {
  const fallback = {
    municipalityCode: null,
    municipality: city || null,
    state: null,
    stateCode: stateCode || null,
    immediateRegion: null,
    intermediateRegion: null,
    population: null,
    populationYear: null,
  };
  if (!city || !/^[A-Z]{2}$/.test(stateCode)) return fallback;
  const payload = await fetchJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(stateCode)}/municipios?orderBy=nome`);
  if (!Array.isArray(payload)) throw new Error("Municípios do IBGE indisponíveis");
  const normalizedCity = normalizeText(city);
  const municipalities = payload.filter(isRecord);
  const municipality =
    municipalities.find((item) => normalizeText(String(item.nome ?? "")) === normalizedCity) ??
    municipalities.find((item) => {
      const name = normalizeText(String(item.nome ?? ""));
      return name && (normalizedCity.includes(name) || name.includes(normalizedCity));
    });
  if (!municipality) return fallback;
  const immediate = readNestedRecord(municipality, "regiao-imediata");
  const intermediate = readNestedRecord(immediate, "regiao-intermediaria");
  const uf = readNestedRecord(intermediate, "UF");
  const municipalityCode = String(municipality.id ?? "");
  let population: number | null = null;
  let populationYear: string | null = null;
  if (/^\d{7}$/.test(municipalityCode)) {
    const populationPayload = await fetchJson(`https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${municipalityCode}]`);
    const latest = latestSeriesValue(populationPayload);
    population = latest.value;
    populationYear = latest.year;
  }
  return {
    municipalityCode: municipalityCode || null,
    municipality: stringOrNull(municipality.nome),
    state: stringOrNull(uf.nome),
    stateCode: stringOrNull(uf.sigla) ?? stateCode,
    immediateRegion: stringOrNull(immediate.nome),
    intermediateRegion: stringOrNull(intermediate.nome),
    population,
    populationYear,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseEarthquake(feature: JsonRecord, latitude: number, longitude: number): EarthquakeItem | null {
  const properties = isRecord(feature.properties) ? feature.properties : {};
  const geometry = isRecord(feature.geometry) ? feature.geometry : {};
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const eventLon = Number(coordinates[0]);
  const eventLat = Number(coordinates[1]);
  const timestamp = Number(properties.time);
  return {
    magnitude: finiteOrNull(properties.mag),
    place: stringOrNull(properties.place) ?? "Local não informado",
    time: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    url: stringOrNull(properties.url) ?? "https://earthquake.usgs.gov/",
    distanceKm: Number.isFinite(eventLat) && Number.isFinite(eventLon) ? Math.round(haversineKm(latitude, longitude, eventLat, eventLon)) : null,
  };
}

export async function loadEarthquakes(latitude: number, longitude: number) {
  const payload = await fetchJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson");
  const record = isRecord(payload) ? payload : {};
  const features = Array.isArray(record.features) ? record.features.filter(isRecord) : [];
  const items = features.map((feature) => parseEarthquake(feature, latitude, longitude)).filter((item): item is EarthquakeItem => item !== null);
  const strongest = [...items].sort((a, b) => (b.magnitude ?? -1) - (a.magnitude ?? -1))[0] ?? null;
  const nearest = [...items].filter((item) => item.distanceKm !== null).sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))[0] ?? null;
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  return { count24h: Math.max(0, Number(metadata.count) || items.length), strongest, nearest };
}

export function hasCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
