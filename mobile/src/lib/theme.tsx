import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";
import type { LeadStage } from "@/lib/database.types";
import type { Tone } from "@/lib/meta";

const light = {
  ink: "#15171c",
  inkMuted: "#4a4f5c",
  inkSubtle: "#7a7f8c",
  line: "#e5e0d6",
  paper: "#fbfaf6",
  paperSoft: "#f3f0e8",
  /** Cards, inputs, and bars that sit on the page background. */
  surface: "#ffffff",
  /** Text and icons on brand or danger fills. */
  onBrand: "#ffffff",
  brand: "#2f438e",
  /** Brand colour for text, links, and icons on the page or a surface. */
  accent: "#2f438e",
  gold: "#b48e4d",
  night: "#0b0b0d",
  danger: "#b42318",
  success: "#10b981",
};

export type Palette = typeof light;
export type Scheme = "light" | "dark";
export type ThemePreference = "system" | Scheme;

const dark: Palette = {
  ink: "#ecebe6",
  inkMuted: "#b6b9c2",
  inkSubtle: "#868b97",
  line: "#2b2e36",
  paper: "#0e0f12",
  paperSoft: "#1a1c21",
  surface: "#15171b",
  onBrand: "#ffffff",
  brand: "#3d53a8",
  accent: "#9aaaf0",
  gold: "#c9a467",
  night: "#0b0b0d",
  danger: "#e5534b",
  success: "#34d399",
};

export const palettes: Record<Scheme, Palette> = { light, dark };

export const tones: Record<Scheme, Record<Tone, { fg: string; bg: string }>> = {
  light: {
    neutral: { fg: light.inkMuted, bg: light.paperSoft },
    info: { fg: "#0b6aa2", bg: "#e6f2fa" },
    brand: { fg: light.brand, bg: "#e8ecf8" },
    warning: { fg: "#a15c07", bg: "#fdf3e1" },
    success: { fg: "#067647", bg: "#e7f6ee" },
    danger: { fg: light.danger, bg: "#fdecea" },
  },
  dark: {
    neutral: { fg: dark.inkMuted, bg: dark.paperSoft },
    info: { fg: "#7cc4f0", bg: "#10283a" },
    brand: { fg: dark.accent, bg: "#1d2547" },
    warning: { fg: "#f0b860", bg: "#33240c" },
    success: { fg: "#5fd39a", bg: "#0f2e20" },
    danger: { fg: "#f28b82", bg: "#3a1512" },
  },
};

export const stageDot: Record<LeadStage, string> = {
  new: "#a3a3a3",
  qualified: "#0ea5e9",
  proposal: "#4a5fb0",
  negotiation: "#f59e0b",
  won: "#10b981",
  lost: "#f87171",
};

const PREFERENCE_KEY = "largis-theme";

type ThemeValue = {
  scheme: Scheme;
  colors: Palette;
  tones: Record<Tone, { fg: string; bg: string }>;
  navigation: NavigationTheme;
  preference: ThemePreference;
  ready: boolean;
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function navigationTheme(scheme: Scheme): NavigationTheme {
  const c = palettes[scheme];
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.paper, card: c.paper, text: c.ink, border: c.line, notification: c.brand },
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(PREFERENCE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (saved === "light" || saved === "dark") {
          setPreferenceState(saved);
          Appearance.setColorScheme(saved);
        }
        setReady(true);
      });
  }, []);

  const scheme: Scheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palettes[scheme].paper).catch(() => {});
  }, [scheme]);

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: palettes[scheme],
      tones: tones[scheme],
      navigation: navigationTheme(scheme),
      preference,
      ready,
      setPreference: (next) => {
        setPreferenceState(next);
        Appearance.setColorScheme(next === "system" ? "unspecified" : next);
        SecureStore.setItemAsync(PREFERENCE_KEY, next).catch(() => {});
      },
    }),
    [scheme, preference, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

export function useColors() {
  return useTheme().colors;
}

/** Builds a style sheet for each scheme once; the returned hook picks the current one. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(build: (c: Palette) => T) {
  const sheets: Record<Scheme, T> = {
    light: StyleSheet.create(build(light)),
    dark: StyleSheet.create(build(dark)),
  };
  return function useStyles(): T {
    return sheets[useTheme().scheme];
  };
}
