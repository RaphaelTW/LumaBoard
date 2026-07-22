"use client";

import type { WeatherSnapshot } from "./weather";
import { isRecord, safeParseJSON, writeStoredValue } from "./storage";

export const RAIN_RULE_ID = "rain-alert";
export const RAIN_RULE_COOLDOWN_MINUTES = 60;
export const WEATHER_MAX_AGE_MINUTES = 45;

export type AutomationHistoryEvent = {
  id: string;
  ruleId: string;
  message: string;
  createdAt: string;
  value: number;
};

export type RainRuleConfig = {
  threshold: number;
};

export type LocalAutomationRule = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastEvaluatedAt: string | null;
  lastExecutedAt: string | null;
  lastSignature: string | null;
  config: RainRuleConfig;
};

export type AutomationState = {
  version: number;
  rules: LocalAutomationRule[];
  history: AutomationHistoryEvent[];
};

export type RainEvaluation = {
  status:
    | "monitoring"
    | "rain-likely"
    | "no-risk"
    | "cached"
    | "unavailable"
    | "disabled";
  currentProbability: number | null;
  maxProbability: number | null;
  likelyAt: string | null;
  stale: boolean;
  shouldAlert: boolean;
  reason: string;
  signature: string | null;
};

export const defaultAutomationState: AutomationState = {
  version: 2,
  rules: [
    {
      id: RAIN_RULE_ID,
      name: "Alerta de chuva",
      trigger: "Chuva > 60%",
      action: "Priorizar tela Clima",
      enabled: true,
      cooldownMinutes: RAIN_RULE_COOLDOWN_MINUTES,
      lastEvaluatedAt: null,
      lastExecutedAt: null,
      lastSignature: null,
      config: { threshold: 60 },
    },
    {
      id: "work-mode",
      name: "Modo trabalho",
      trigger: "Seg-Sex as 08:00",
      action: "Ativar playlist Trabalho",
      enabled: true,
      cooldownMinutes: 60,
      lastEvaluatedAt: null,
      lastExecutedAt: null,
      lastSignature: null,
      config: { threshold: 60 },
    },
    {
      id: "night-saver",
      name: "Economia noturna",
      trigger: "Todos os dias as 22:30",
      action: "Suspender atualizacoes",
      enabled: true,
      cooldownMinutes: 60,
      lastEvaluatedAt: null,
      lastExecutedAt: null,
      lastSignature: null,
      config: { threshold: 60 },
    },
  ],
  history: [],
};

export function clampRainThreshold(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 60;
  return Math.min(100, Math.max(10, Math.round(number)));
}

export function validateAutomationState(value: unknown): value is AutomationState {
  if (!isRecord(value)) return false;
  if (typeof value.version !== "number") return false;
  if (!Array.isArray(value.rules) || !Array.isArray(value.history)) return false;
  return value.rules.every(isAutomationRule);
}

function isAutomationRule(value: unknown): value is LocalAutomationRule {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.trigger === "string" &&
    typeof value.action === "string" &&
    typeof value.enabled === "boolean" &&
    typeof value.cooldownMinutes === "number" &&
    isRecord(value.config)
  );
}

export function migrateAutomationState(value: unknown): AutomationState {
  if (validateAutomationState(value)) {
    const hasRain = value.rules.some((rule) => rule.id === RAIN_RULE_ID);
    return {
      ...value,
      rules: hasRain
        ? value.rules.map(normalizeRule)
        : [defaultAutomationState.rules[0], ...value.rules.map(normalizeRule)],
      history: value.history.filter(isHistoryEvent),
    };
  }

  if (Array.isArray(value)) {
    return {
      ...defaultAutomationState,
      rules: [
        defaultAutomationState.rules[0],
        ...value
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item, index) =>
            normalizeRule({
              id: typeof item.id === "number" ? `legacy-${item.id}` : `legacy-${index}`,
              name: typeof item.name === "string" ? item.name : "Regra local",
              trigger: typeof item.trigger === "string" ? item.trigger : "Configuracao visual",
              action: typeof item.action === "string" ? item.action : "Requer backend",
              enabled: item.enabled !== false,
              cooldownMinutes: 60,
              lastEvaluatedAt: null,
              lastExecutedAt: null,
              lastSignature: null,
              config: { threshold: 60 },
            }),
          ),
      ],
    };
  }

  return defaultAutomationState;
}

function normalizeRule(rule: LocalAutomationRule): LocalAutomationRule {
  return {
    ...rule,
    cooldownMinutes: Number.isFinite(rule.cooldownMinutes)
      ? rule.cooldownMinutes
      : 60,
    lastEvaluatedAt:
      typeof rule.lastEvaluatedAt === "string" ? rule.lastEvaluatedAt : null,
    lastExecutedAt:
      typeof rule.lastExecutedAt === "string" ? rule.lastExecutedAt : null,
    lastSignature: typeof rule.lastSignature === "string" ? rule.lastSignature : null,
    config: { threshold: clampRainThreshold(rule.config?.threshold) },
  };
}

function isHistoryEvent(value: unknown): value is AutomationHistoryEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.ruleId === "string" &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.value === "number"
  );
}

export function readAutomationState(): AutomationState {
  const raw =
    typeof window === "undefined"
      ? null
      : safeParseJSON(window.localStorage.getItem("lumaboard-rules"));
  return migrateAutomationState(raw);
}

export function writeAutomationState(state: AutomationState) {
  writeStoredValue("lumaboard-rules", state);
}

export function evaluateRainRule(
  rule: LocalAutomationRule,
  weather: WeatherSnapshot,
  now = new Date(),
): RainEvaluation {
  if (!rule.enabled) {
    return emptyEvaluation("disabled", "Regra desativada");
  }

  if (!weather.updatedAt || weather.hourly.length === 0) {
    return emptyEvaluation("unavailable", "Previsao indisponivel");
  }

  const updatedAt = parseWeatherDate(weather.updatedAt, weather.timezone);
  const stale =
    !updatedAt ||
    now.getTime() - updatedAt.getTime() > WEATHER_MAX_AGE_MINUTES * 60_000;
  if (stale) return emptyEvaluation("cached", "Dados em cache", true);

  const nextSixHours = weather.hourly
    .map((hour) => ({
      ...hour,
      date: parseWeatherDate(hour.time, weather.timezone),
    }))
    .filter((hour) => hour.date && hour.date.getTime() >= now.getTime())
    .slice(0, 6);

  if (nextSixHours.length === 0) {
    return emptyEvaluation("unavailable", "Previsao indisponivel");
  }

  const currentProbability = nextSixHours[0].precipitationProbability;
  const valid = nextSixHours.filter(
    (hour) => hour.precipitationProbability !== null,
  );
  if (valid.length === 0) {
    return emptyEvaluation("unavailable", "Probabilidade indisponivel");
  }

  const maxHour = valid.reduce((best, hour) =>
    Number(hour.precipitationProbability) > Number(best.precipitationProbability)
      ? hour
      : best,
  );
  const maxProbability = Number(maxHour.precipitationProbability);
  const signature = `${maxHour.time}:${maxProbability}`;
  const reachesThreshold = maxProbability >= clampRainThreshold(rule.config.threshold);

  const cooldownActive =
    Boolean(rule.lastExecutedAt) &&
    now.getTime() - new Date(String(rule.lastExecutedAt)).getTime() <
      rule.cooldownMinutes * 60_000;
  const duplicate = rule.lastSignature === signature;

  return {
    status: reachesThreshold ? "rain-likely" : "no-risk",
    currentProbability,
    maxProbability,
    likelyAt: maxHour.time,
    stale: false,
    shouldAlert: reachesThreshold && !cooldownActive && !duplicate,
    reason: reachesThreshold
      ? cooldownActive
        ? "Cooldown ativo"
        : duplicate
          ? "Alerta ja registrado"
          : "Limite atingido"
      : "Sem risco relevante",
    signature,
  };
}

function emptyEvaluation(
  status: RainEvaluation["status"],
  reason: string,
  stale = false,
): RainEvaluation {
  return {
    status,
    currentProbability: null,
    maxProbability: null,
    likelyAt: null,
    stale,
    shouldAlert: false,
    reason,
    signature: null,
  };
}

function parseWeatherDate(value: string, timezone: string): Date | null {
  if (!value) return null;
  if (value.includes("T") && !/[zZ]|[+-]\d\d:?\d\d$/.test(value)) {
    const offset = timezoneOffsetMinutes(timezone, new Date(`${value}:00Z`));
    return new Date(`${value}:00Z`.replace("Z", formatOffset(offset)));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timezoneOffsetMinutes(timezone: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === "+" ? 1 : -1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  } catch {
    return 0;
  }
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function recordRainAlert(
  state: AutomationState,
  rule: LocalAutomationRule,
  evaluation: RainEvaluation,
  now = new Date(),
): AutomationState {
  if (!evaluation.shouldAlert || evaluation.maxProbability === null) return state;
  const message = `Chuva provavel: ${evaluation.maxProbability}% nas proximas 6 horas.`;
  return {
    ...state,
    rules: state.rules.map((current) =>
      current.id === rule.id
        ? {
            ...current,
            lastEvaluatedAt: now.toISOString(),
            lastExecutedAt: now.toISOString(),
            lastSignature: evaluation.signature,
          }
        : current,
    ),
    history: [
      {
        id: `${rule.id}-${now.getTime()}`,
        ruleId: rule.id,
        message,
        createdAt: now.toISOString(),
        value: evaluation.maxProbability,
      },
      ...state.history,
    ].slice(0, 50),
  };
}
