import {
  LAST_LCD_CONFIG_KEY,
  MAX_RECENT_LCD_CONFIGS,
  MIPI_RIGHT_EDITOR_KEY,
  RECENT_LCD_CONFIGS_KEY,
} from "./constants";
import type { RecentLcdConfigItem } from "./types";

export const loadRecentConfigs = (): RecentLcdConfigItem[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_LCD_CONFIGS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RecentLcdConfigItem[];
    return parsed
      .filter((item) => item && typeof item.path === "string" && item.path.trim())
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_RECENT_LCD_CONFIGS);
  } catch {
    return [];
  }
};

export const saveRecentConfig = (path: string, existing: RecentLcdConfigItem[] = []): RecentLcdConfigItem[] => {
  const mergedExisting = [
    ...loadRecentConfigs(),
    ...existing,
  ]
    .filter((item, index, array) => item?.path && array.findIndex((candidate) => candidate.path === item.path) === index)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt);

  const next = [
    { path, lastUsedAt: Date.now() },
    ...mergedExisting.filter((item) => item.path !== path),
  ].slice(0, MAX_RECENT_LCD_CONFIGS);

  window.localStorage.setItem(RECENT_LCD_CONFIGS_KEY, JSON.stringify(next));
  window.localStorage.setItem(LAST_LCD_CONFIG_KEY, path);
  return next;
};

export const getLastLcdConfigPath = () => window.localStorage.getItem(LAST_LCD_CONFIG_KEY);

export const loadMipiRightEditor = () => window.localStorage.getItem(MIPI_RIGHT_EDITOR_KEY) || "";

export const saveMipiRightEditor = (value: string) => {
  window.localStorage.setItem(MIPI_RIGHT_EDITOR_KEY, value);
};
