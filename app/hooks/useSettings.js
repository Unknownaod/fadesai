"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../lib/constants";

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Load saved settings once, on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);

      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error("Failed to load Fades settings:", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist settings whenever they change.
  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [settings, hydrated]);

  // Apply theme + compact mode to <html>.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.compact = settings.compactMode ? "true" : "false";

    if (settings.theme !== "system") {
      root.dataset.theme = settings.theme;
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme = query.matches ? "dark" : "light";
    };

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [settings.theme, settings.compactMode]);

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return { settings, updateSetting, hydrated };
}
