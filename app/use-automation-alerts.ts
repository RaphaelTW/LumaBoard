"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RAIN_RULE_ID,
  defaultAutomationState,
  evaluateRainRule,
  readAutomationState,
  recordRainAlert,
  type LocalAutomationRule,
} from "./automation";
import { writeStoredValue } from "./storage";
import type { WeatherSnapshot, WeatherStatus } from "./weather";
import type { View } from "./modules";

export function useAutomationAlerts({
  weather,
  weatherStatus,
  now,
  onToast,
  onNavigate,
}: {
  weather: WeatherSnapshot;
  weatherStatus: WeatherStatus;
  now: Date;
  onToast: (message: string) => void;
  onNavigate: (view: View) => void;
}) {
  const [automationState, setAutomationState] = useState(defaultAutomationState);
  const rainRule =
    automationState.rules.find((rule) => rule.id === RAIN_RULE_ID) ??
    defaultAutomationState.rules[0];
  const rainEvaluation = useMemo(
    () => evaluateRainRule(rainRule, weather, now),
    [rainRule, weather, now],
  );

  useEffect(() => {
    queueMicrotask(() => setAutomationState(readAutomationState()));
  }, []);

  const updateRainRule = (nextRule: LocalAutomationRule) => {
    setAutomationState((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule)),
    }));
  };

  const clearRainHistory = () => {
    const next = {
      ...readAutomationState(),
      history: [],
    };
    writeStoredValue("lumaboard-rules", next);
    setAutomationState(next);
    onToast("Histórico de alertas limpo.");
  };

  useEffect(() => {
    const state = readAutomationState();
    const rule = state.rules.find((item) => item.id === RAIN_RULE_ID);
    if (!rule) return;
    const evaluation = evaluateRainRule(rule, weather, new Date());
    const evaluated = {
      ...state,
      rules: state.rules.map((item) =>
        item.id === RAIN_RULE_ID
          ? { ...item, lastEvaluatedAt: new Date().toISOString() }
          : item,
      ),
    };
    const next = recordRainAlert(evaluated, rule, evaluation);
    writeStoredValue("lumaboard-rules", next);
    queueMicrotask(() => setAutomationState(next));
    if (!evaluation.shouldAlert || evaluation.maxProbability === null) return;
    queueMicrotask(() => {
      onToast(`Chuva provável: ${evaluation.maxProbability}% nas próximas 6h.`);
      onNavigate("automation");
    });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("LumaBoard: alerta de chuva", {
        body: `Probabilidade de ${evaluation.maxProbability}% perto de ${weather.city}.`,
      });
    }
  }, [onNavigate, onToast, weather, weatherStatus]);

  return { rainEvaluation, updateRainRule, clearRainHistory };
}
