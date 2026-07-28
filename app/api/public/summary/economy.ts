import { fetchJson } from "./fetch-json";
import type { HolidayItem } from "./summary-types";
import { finiteOrNull, isRecord, localDateKey, stringOrNull } from "./utils";

export async function loadRates() {
  const [usdPayload, eurPayload] = await Promise.all([
    fetchJson("https://api.frankfurter.dev/v2/rate/USD/BRL"),
    fetchJson("https://api.frankfurter.dev/v2/rate/EUR/BRL"),
  ]);
  const usd = isRecord(usdPayload) ? usdPayload : {};
  const eur = isRecord(eurPayload) ? eurPayload : {};
  return {
    date: typeof usd.date === "string" ? usd.date : typeof eur.date === "string" ? eur.date : null,
    usdBrl: finiteOrNull(usd.rate),
    eurBrl: finiteOrNull(eur.rate),
  };
}

export async function loadHoliday(year: number): Promise<HolidayItem | null> {
  const payloads = await Promise.all([
    fetchJson(`https://brasilapi.com.br/api/feriados/v1/${year}`),
    fetchJson(`https://brasilapi.com.br/api/feriados/v1/${year + 1}`),
  ]);
  const payload = payloads.flatMap((item) => (Array.isArray(item) ? item : []));
  if (payload.length === 0) throw new Error("Feriados inválidos");
  const todayKey = localDateKey();
  return payload
    .filter(isRecord)
    .map((item): HolidayItem | null => {
      const date = typeof item.date === "string" ? item.date : "";
      const name = typeof item.name === "string" ? item.name : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) return null;
      return { date, name, type: typeof item.type === "string" ? item.type : "national" };
    })
    .filter((item): item is HolidayItem => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((item) => item.date >= todayKey) ?? null;
}

function parseBcbItem(value: unknown): { date: string | null; value: number | null } {
  const first = Array.isArray(value) && isRecord(value[0]) ? value[0] : {};
  return { date: stringOrNull(first.data), value: finiteOrNull(first.valor) };
}

export async function loadEconomy() {
  const [selicPayload, ipcaPayload] = await Promise.all([
    fetchJson("https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/1?formato=json"),
    fetchJson("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json"),
  ]);
  const selic = parseBcbItem(selicPayload);
  const ipca = parseBcbItem(ipcaPayload);
  return {
    selicAnnual: selic.value,
    selicDate: selic.date,
    ipcaMonthly: ipca.value,
    ipcaDate: ipca.date,
  };
}
