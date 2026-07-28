import type { JsonRecord } from "./summary-types";
import { safePublicHttpsUrl, sanitizePublicText } from "../security";

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function stringOrNull(value: unknown, maximumLength = 4_000): string | null {
  const normalized = sanitizePublicText(value, maximumLength);
  return normalized || null;
}

export function safeHttpUrl(value: unknown, allowedHosts?: readonly string[]): string | null {
  return safePublicHttpsUrl(value, allowedHosts ? { allowedHosts } : {});
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function localDateKey(timeZone = "America/Sao_Paulo"): string {
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

export function readNestedRecord(record: JsonRecord, key: string): JsonRecord {
  return isRecord(record[key]) ? record[key] : {};
}
