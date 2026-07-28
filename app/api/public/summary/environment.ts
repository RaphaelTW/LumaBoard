import { fetchJson } from "./fetch-json";
import { finiteOrNull, isRecord, stringOrNull } from "./utils";

export async function loadAirQuality(latitude: number, longitude: number) {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "european_aqi,pm2_5");
  url.searchParams.set("timezone", "auto");
  const payload = await fetchJson(url.toString());
  const current = isRecord(payload) && isRecord(payload.current) ? payload.current : {};
  return {
    europeanAqi: finiteOrNull(current.european_aqi),
    pm25: finiteOrNull(current.pm2_5),
    updatedAt: typeof current.time === "string" ? current.time : null,
  };
}

export async function loadElevation(latitude: number, longitude: number) {
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  const payload = await fetchJson(url.toString());
  const values = isRecord(payload) && Array.isArray(payload.elevation) ? payload.elevation : [];
  return finiteOrNull(values[0]);
}

export async function loadFlood(latitude: number, longitude: number) {
  const url = new URL("https://flood-api.open-meteo.com/v1/flood");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "river_discharge,river_discharge_mean,river_discharge_max");
  url.searchParams.set("forecast_days", "3");
  const payload = await fetchJson(url.toString());
  const daily = isRecord(payload) && isRecord(payload.daily) ? payload.daily : {};
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const discharges = Array.isArray(daily.river_discharge) ? daily.river_discharge : [];
  const means = Array.isArray(daily.river_discharge_mean) ? daily.river_discharge_mean : [];
  const maximums = Array.isArray(daily.river_discharge_max) ? daily.river_discharge_max : [];
  return {
    date: stringOrNull(dates[0]),
    discharge: finiteOrNull(discharges[0]),
    mean: finiteOrNull(means[0]),
    maximum: finiteOrNull(maximums[0]),
  };
}

export async function loadMarine(latitude: number, longitude: number) {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "wave_height,sea_surface_temperature,ocean_current_velocity");
  url.searchParams.set("timezone", "auto");
  const payload = await fetchJson(url.toString());
  const current = isRecord(payload) && isRecord(payload.current) ? payload.current : {};
  return {
    updatedAt: stringOrNull(current.time),
    waveHeightM: finiteOrNull(current.wave_height),
    seaTemperatureC: finiteOrNull(current.sea_surface_temperature),
    currentVelocityKmh: finiteOrNull(current.ocean_current_velocity),
  };
}

export async function loadSun(latitude: number, longitude: number, timezone: string) {
  const url = new URL("https://api.sunrise-sunset.org/v2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude));
  if (timezone) url.searchParams.set("tz", timezone);
  const payload = await fetchJson(url.toString());
  const record = isRecord(payload) ? payload : {};
  const goldenHour = isRecord(record.golden_hour) ? record.golden_hour : {};
  const eveningGoldenHour = isRecord(goldenHour.evening) ? goldenHour.evening : {};
  return {
    sunrise: stringOrNull(record.sunrise),
    sunset: stringOrNull(record.sunset),
    goldenHourEnd: stringOrNull(eveningGoldenHour.end),
    dayLengthSeconds: finiteOrNull(record.day_length),
    moonPhase: stringOrNull(record.moon_phase),
    moonIllumination: finiteOrNull(record.moon_illumination),
  };
}
