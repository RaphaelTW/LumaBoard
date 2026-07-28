"use client";

import { useCallback, useEffect, useState } from "react";
import { readStoredValue, writeStoredValue } from "./storage";

const PROFILE_KEY = "lumaboard-user-profile-v1";

function normalizeInitials(value: string, fallback = "RS") {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").slice(0, 3).toUpperCase() || fallback;
}

export function useAvatarProfile(onToast: (message: string) => void) {
  const [avatarInitials, setAvatarInitials] = useState("RS");

  useEffect(() => {
    queueMicrotask(() => {
      const profile = readStoredValue(
        PROFILE_KEY,
        (value): value is { initials: string } =>
          typeof value === "object" &&
          value !== null &&
          "initials" in value &&
          typeof (value as { initials?: unknown }).initials === "string",
        { initials: "RS" },
      );
      setAvatarInitials(normalizeInitials(profile.initials));
    });
  }, []);

  const updateAvatarInitials = useCallback((value: string) => {
    const next = normalizeInitials(value, "EU");
    setAvatarInitials(next);
    writeStoredValue(PROFILE_KEY, { initials: next });
    onToast("Iniciais do perfil salvas neste navegador.");
  }, [onToast]);

  return { avatarInitials, updateAvatarInitials };
}
