import { describe, expect, it } from "vitest";
import {
  RAIN_RULE_ID,
  defaultAutomationState,
  evaluateRainRule,
  migrateAutomationState,
  recordRainAlert,
} from "./automation";
import type { WeatherSnapshot } from "./weather";

const rule = defaultAutomationState.rules.find((item) => item.id === RAIN_RULE_ID)!;

function weather(probabilities: Array<number | null>, updatedAt = "2026-07-21T12:00"): WeatherSnapshot {
  return {
    city: "São Paulo",
    state: "São Paulo",
    stateCode: "SP",
    countryCode: "BR",
    latitude: -23.55,
    longitude: -46.63,
    temperature: 22,
    apparentTemperature: 23,
    minimum: 18,
    maximum: 26,
    weatherCode: 61,
    isDay: true,
    description: "Chuva",
    timezone: "America/Sao_Paulo",
    updatedAt,
    locationSource: "gps",
    hourly: probabilities.map((precipitationProbability, index) => ({
      time: `2026-07-21T${String(12 + index).padStart(2, "0")}:00`,
      precipitationProbability,
      precipitation: 0,
      rain: 0,
      showers: 0,
      weatherCode: 61,
      description: "Chuva",
    })),
  };
}

describe("rain automation", () => {
  it("alerts at the exact 60 percent threshold", () => {
    const result = evaluateRainRule(rule, weather([20, 60]), new Date("2026-07-21T12:00:00-03:00"));
    expect(result.status).toBe("rain-likely");
    expect(result.shouldAlert).toBe(true);
  });

  it("does not alert below the threshold", () => {
    const result = evaluateRainRule(rule, weather([10, 59]), new Date("2026-07-21T12:00:00-03:00"));
    expect(result.status).toBe("no-risk");
    expect(result.shouldAlert).toBe(false);
  });

  it("alerts above the threshold", () => {
    const result = evaluateRainRule(rule, weather([10, 85]), new Date("2026-07-21T12:00:00-03:00"));
    expect(result.maxProbability).toBe(85);
    expect(result.shouldAlert).toBe(true);
  });

  it("ignores missing hourly data", () => {
    const result = evaluateRainRule(rule, { ...weather([]), hourly: [] }, new Date("2026-07-21T12:00:00-03:00"));
    expect(result.status).toBe("unavailable");
    expect(result.shouldAlert).toBe(false);
  });

  it("ignores stale weather data", () => {
    const result = evaluateRainRule(rule, weather([90], "2026-07-21T08:00"), new Date("2026-07-21T12:00:00-03:00"));
    expect(result.status).toBe("cached");
    expect(result.shouldAlert).toBe(false);
  });

  it("honors cooldown", () => {
    const result = evaluateRainRule(
      { ...rule, lastExecutedAt: "2026-07-21T11:30:00-03:00" },
      weather([90]),
      new Date("2026-07-21T12:00:00-03:00"),
    );
    expect(result.shouldAlert).toBe(false);
    expect(result.reason).toBe("Cooldown ativo");
  });

  it("deduplicates the same alert signature", () => {
    const result = evaluateRainRule(
      { ...rule, lastSignature: "2026-07-21T12:00:90" },
      weather([90]),
      new Date("2026-07-21T12:00:00-03:00"),
    );
    expect(result.shouldAlert).toBe(false);
    expect(result.reason).toBe("Alerta ja registrado");
  });

  it("records history when an alert is valid", () => {
    const evaluation = evaluateRainRule(rule, weather([90]), new Date("2026-07-21T12:00:00-03:00"));
    const state = recordRainAlert(defaultAutomationState, rule, evaluation, new Date("2026-07-21T12:00:00-03:00"));
    expect(state.history).toHaveLength(1);
    expect(state.rules[0].lastExecutedAt).toBe("2026-07-21T15:00:00.000Z");
  });

  it("drops legacy visual-only rules", () => {
    const migrated = migrateAutomationState([{ id: 1, name: "Legado", trigger: "x", action: "y", enabled: true }]);
    expect(migrated.version).toBe(3);
    expect(migrated.rules.some((item) => item.id === RAIN_RULE_ID)).toBe(true);
  });
});
