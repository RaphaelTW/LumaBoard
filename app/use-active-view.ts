"use client";

import { useEffect, useState } from "react";
import type { View } from "./modules";
import { writeStoredValue } from "./storage";

const LAST_VIEW_KEY = "lumaboard-last-view-v1";

export function useActiveView(availableViews: View[]) {
  const [activeView, setActiveView] = useState<View>("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view") ?? window.localStorage.getItem(LAST_VIEW_KEY);
    if (requestedView && availableViews.includes(requestedView as View)) {
      queueMicrotask(() => setActiveView(requestedView as View));
    }
  }, [availableViews]);

  useEffect(() => {
    writeStoredValue(LAST_VIEW_KEY, activeView);
    const url = new URL(window.location.href);
    if (activeView === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", activeView);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [activeView]);

  return { activeView, setActiveView };
}
