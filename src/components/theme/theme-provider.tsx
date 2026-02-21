// Track Your Shit - Theme Provider
// Extended with accent color, UI density, and font scale support
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useEffect, useState, useCallback, ReactNode } from "react";
import {
  ThemeContext,
  Theme,
  AccentColor,
  UiDensity,
  FontScale,
  FontFamily,
} from "@/hooks/use-theme";
import { getSettings, updateSettings, Settings } from "@/lib/tauri";

const THEME_KEY = "track-your-shit-theme";
const ACCENT_KEY = "track-your-shit-accent";
const DENSITY_KEY = "track-your-shit-density";
const FONT_SCALE_KEY = "track-your-shit-font-scale";
const FONT_FAMILY_KEY = "track-your-shit-font-family";

const ACCENT_CLASSES: Record<AccentColor, string> = {
  default: "",
  ocean: "theme-ocean",
  forest: "theme-forest",
  sunset: "theme-sunset",
  purple: "theme-purple",
};

const DENSITY_CLASSES: Record<UiDensity, string> = {
  compact: "density-compact",
  normal: "density-normal",
  spacious: "density-spacious",
};

const FONT_SCALE_CLASSES: Record<FontScale, string> = {
  sm: "font-scale-sm",
  md: "font-scale-md",
  lg: "font-scale-lg",
};

const FONT_FAMILY_CLASSES: Record<FontFamily, string> = {
  system: "",
  inter: "font-family-inter",
  "jetbrains-mono": "font-family-jetbrains",
  monospace: "font-family-mono",
};

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function getInitialAccent(): AccentColor {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(ACCENT_KEY);
  if (stored === "default" || stored === "ocean" || stored === "forest" || stored === "sunset" || stored === "purple") {
    return stored;
  }
  return "default";
}

function getInitialDensity(): UiDensity {
  if (typeof window === "undefined") return "normal";
  const stored = localStorage.getItem(DENSITY_KEY);
  if (stored === "compact" || stored === "normal" || stored === "spacious") {
    return stored;
  }
  return "normal";
}

function getInitialFontScale(): FontScale {
  if (typeof window === "undefined") return "md";
  const stored = localStorage.getItem(FONT_SCALE_KEY);
  if (stored === "sm" || stored === "md" || stored === "lg") {
    return stored;
  }
  return "md";
}

function getInitialFontFamily(): FontFamily {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(FONT_FAMILY_KEY);
  if (stored === "system" || stored === "inter" || stored === "jetbrains-mono" || stored === "monospace") {
    return stored;
  }
  return "system";
}

function applyAccent(accent: AccentColor) {
  const root = document.documentElement;
  for (const cls of Object.values(ACCENT_CLASSES)) {
    if (cls) root.classList.remove(cls);
  }
  const cls = ACCENT_CLASSES[accent];
  if (cls) root.classList.add(cls);
}

function applyDensity(density: UiDensity) {
  const root = document.documentElement;
  for (const cls of Object.values(DENSITY_CLASSES)) {
    if (cls) root.classList.remove(cls);
  }
  const cls = DENSITY_CLASSES[density];
  if (cls) root.classList.add(cls);
}

function applyFontScale(scale: FontScale) {
  const root = document.documentElement;
  for (const cls of Object.values(FONT_SCALE_CLASSES)) {
    if (cls) root.classList.remove(cls);
  }
  const cls = FONT_SCALE_CLASSES[scale];
  if (cls) root.classList.add(cls);
}

function applyFontFamily(family: FontFamily) {
  const root = document.documentElement;
  for (const cls of Object.values(FONT_FAMILY_CLASSES)) {
    if (cls) root.classList.remove(cls);
  }
  const cls = FONT_FAMILY_CLASSES[family];
  if (cls) root.classList.add(cls);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme);
  const [accentColor, setAccentState] = useState<AccentColor>(getInitialAccent);
  const [uiDensity, setDensityState] = useState<UiDensity>(getInitialDensity);
  const [fontScale, setFontScaleState] = useState<FontScale>(getInitialFontScale);
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(getInitialFontFamily);

  // Derive resolved theme from theme + system preference
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  // Apply theme classes to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, resolvedTheme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemTheme(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Apply accent color
  useEffect(() => {
    applyAccent(accentColor);
    localStorage.setItem(ACCENT_KEY, accentColor);
  }, [accentColor]);

  // Apply density
  useEffect(() => {
    applyDensity(uiDensity);
    localStorage.setItem(DENSITY_KEY, uiDensity);
  }, [uiDensity]);

  // Apply font scale
  useEffect(() => {
    applyFontScale(fontScale);
    localStorage.setItem(FONT_SCALE_KEY, fontScale);
  }, [fontScale]);

  // Apply font family
  useEffect(() => {
    applyFontFamily(fontFamily);
    localStorage.setItem(FONT_FAMILY_KEY, fontFamily);
  }, [fontFamily]);

  // Sync with backend settings on mount
  useEffect(() => {
    getSettings()
      .then((settings) => {
        if (settings.theme && settings.theme !== theme) {
          const validTheme = settings.theme as Theme;
          if (validTheme === "light" || validTheme === "dark" || validTheme === "system") {
            setThemeState(validTheme);
          }
        }
      })
      .catch(() => {
        // Ignore errors - use local storage value
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);

    // Persist to backend (fire-and-forget)
    void getSettings()
      .then((settings) => {
        const updated: Settings = { ...settings, theme: newTheme };
        return updateSettings(updated);
      })
      .catch(() => {
        // Ignore errors - theme is still applied locally
      });
  }, []);

  const setAccentColor = useCallback((accent: AccentColor) => {
    setAccentState(accent);
    localStorage.setItem(ACCENT_KEY, accent);
  }, []);

  const setUiDensity = useCallback((density: UiDensity) => {
    setDensityState(density);
    localStorage.setItem(DENSITY_KEY, density);
  }, []);

  const setFontScale = useCallback((scale: FontScale) => {
    setFontScaleState(scale);
    localStorage.setItem(FONT_SCALE_KEY, scale);
  }, []);

  const setFontFamily = useCallback((family: FontFamily) => {
    setFontFamilyState(family);
    localStorage.setItem(FONT_FAMILY_KEY, family);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        accentColor,
        setAccentColor,
        uiDensity,
        setUiDensity,
        fontScale,
        setFontScale,
        fontFamily,
        setFontFamily,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
