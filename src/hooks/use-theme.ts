// Track Your Shit - Theme Hook
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";
export type AccentColor = "default" | "ocean" | "forest" | "sunset" | "purple";
export type UiDensity = "compact" | "normal" | "spacious";
export type FontScale = "sm" | "md" | "lg";
export type FontFamily = "system" | "inter" | "jetbrains-mono" | "monospace";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
  accentColor: AccentColor;
  setAccentColor: (accent: AccentColor) => void;
  uiDensity: UiDensity;
  setUiDensity: (density: UiDensity) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  fontFamily: FontFamily;
  setFontFamily: (family: FontFamily) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
