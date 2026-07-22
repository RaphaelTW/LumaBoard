import { describe, expect, it } from "vitest";
import {
  describeWeatherCode,
  isStoredLocation,
  resolveLocationFallback,
} from "./weather";

describe("weather helpers", () => {
  it("describes weather codes in Portuguese", () => {
    expect(describeWeatherCode(0)).toBe("Céu limpo");
    expect(describeWeatherCode(61)).toBe("Chuva");
    expect(describeWeatherCode(80)).toBe("Pancadas de chuva");
    expect(describeWeatherCode(999)).toBe("Trovoadas");
  });

  it("validates stored locations", () => {
    expect(isStoredLocation({ latitude: -23.5, longitude: -46.6, city: "São Paulo", source: "gps", savedAt: 1 })).toBe(true);
    expect(isStoredLocation({ latitude: "x", longitude: -46.6, city: "São Paulo" })).toBe(false);
  });

  it("falls back to São Paulo when location services fail", () => {
    const fallback = resolveLocationFallback(null);
    expect(fallback.city).toBe("São Paulo");
    expect(fallback.source).toBe("fallback");
  });
});
