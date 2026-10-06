// Design tokens for Futbase / Liga Alevín.
//
// This app has TWO layers of color:
//   1. A tiny static light theme (`light`) used by the app-level ErrorBoundary
//      via makeStyles/useTheme. Do not remove these exports.
//   2. A DYNAMIC club palette chosen by the coach (preset / custom colors /
//      dark mode) persisted on the backend and applied at runtime through
//      AppThemeProvider + useAppColors. Every in-app screen uses this.

import { useMemo, createContext, useContext, useState, useCallback } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#111827",
  surfaceSecondary: "#F9FAFB",
  onSurfaceSecondary: "#374151",
  surfaceTertiary: "#F3F4F6",
  onSurfaceTertiary: "#4B5563",
  surfaceInverse: "#1F2937",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7280",
  brand: "#1E3A5F",
  onBrand: "#FFFFFF",
  brandPrimary: "#1E3A5F",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E5E7EB",
  onBrandSecondary: "#111827",
  brandTertiary: "#F3F4F6",
  onBrandTertiary: "#111827",
  success: "#15803D",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#B91C1C",
  onError: "#FFFFFF",
  info: "#1D4ED8",
  onInfo: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#E5E7EB",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// ============================================================================
// Dynamic club theming (coach-controlled palette persisted on the backend)
// ============================================================================

export type BrandPalette = {
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentHover: string;
  _tertiary?: string | null;
};

export const THEME_PRESETS: Record<string, BrandPalette> = {
  navy_gold: { name: "Azul Marino & Oro", primary: "#1E3A5F", primaryDark: "#142942", primaryLight: "#35557E", accent: "#D4A24C", accentHover: "#B9893A" },
  grafito_coral: { name: "Grafito & Coral", primary: "#3A3F47", primaryDark: "#262A30", primaryLight: "#565C66", accent: "#FF6B5E", accentHover: "#E85546" },
  turquesa_tropical: { name: "Turquesa Tropical", primary: "#0E9898", primaryDark: "#0A6E6E", primaryLight: "#2CB7B7", accent: "#FFB23E", accentHover: "#E89A26" },
  verde_menta: { name: "Verde Menta", primary: "#2FA37C", primaryDark: "#227A5D", primaryLight: "#4EC19A", accent: "#FF9B85", accentHover: "#ED8169" },
  violeta_lima: { name: "Violeta & Lima", primary: "#6D4AC4", primaryDark: "#513597", primaryLight: "#8A6CDC", accent: "#B3D43C", accentHover: "#99BA27" },
  carbon_ambar: { name: "Carbón & Ámbar", primary: "#2E3238", primaryDark: "#1C1F24", primaryLight: "#4A4F57", accent: "#F5A623", accentHover: "#D88E10" },
  fucsia_cian: { name: "Fucsia & Cian", primary: "#D6338E", primaryDark: "#A61F6C", primaryLight: "#E85BA8", accent: "#18C3D4", accentHover: "#0FA2B1" },
  bosque_mostaza: { name: "Bosque & Mostaza", primary: "#2F5D4C", primaryDark: "#214338", primaryLight: "#43806A", accent: "#E0B74A", accentHover: "#C49E34" },
  rojo_negro_oro: { name: "Rojo, Negro & Oro", primary: "#A42A28", primaryDark: "#2A1312", primaryLight: "#C25450", accent: "#C9A227", accentHover: "#AD8A1C" },
  borgona_oro_viejo: { name: "Borgoña & Oro Viejo", primary: "#5E2130", primaryDark: "#3A121C", primaryLight: "#7E3A49", accent: "#A9833F", accentHover: "#8E6C31" },
  verde_bosque: { name: "Verde Bosque", primary: "#2A4034", primaryDark: "#1A281F", primaryLight: "#3E5C4C", accent: "#8A9A5B", accentHover: "#74834A" },
  oliva_militar: { name: "Oliva Militar", primary: "#555F2F", primaryDark: "#363D1E", primaryLight: "#727E42", accent: "#B5A642", accentHover: "#9A8C36" },
  tierra_cobre: { name: "Tierra & Cobre", primary: "#6B4F3A", primaryDark: "#42301F", primaryLight: "#8A6B52", accent: "#B87333", accentHover: "#9C5F27" },
  pizarra_acero: { name: "Pizarra & Acero", primary: "#3C464E", primaryDark: "#262D33", primaryLight: "#566069", accent: "#8A97A1", accentHover: "#6F7C86" },
  azul_acero: { name: "Azul Acero", primary: "#2F4858", primaryDark: "#1D2E38", primaryLight: "#456576", accent: "#7FA6BC", accentHover: "#668CA2" },
  grafito_bronce: { name: "Grafito & Bronce", primary: "#33373D", primaryDark: "#202327", primaryLight: "#4C515A", accent: "#B08D57", accentHover: "#977644" },
};

export const LIGHT_BASE = { bg: "#F4F5F7", card: "#FFFFFF", text: "#1A1D23", muted: "#6B7280", border: "#E6E8EC" };
export const DARK_BASE = { bg: "#000000", card: "#0E0E0E", text: "#F3F4F6", muted: "#9BA1A8", border: "#232323" };

const _clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const _hexToRgb = (h: string) => {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const _rgbToHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((x) => _clamp(x).toString(16).padStart(2, "0")).join("");
const _mix = (hex: string, target: number[], amt: number) => {
  const [r, g, b] = _hexToRgb(hex);
  const [tr, tg, tb] = target;
  return _rgbToHex(r + (tr - r) * amt, g + (tg - g) * amt, b + (tb - b) * amt);
};

export const buildCustomTheme = (primary: string, accent: string, tertiary?: string | null): BrandPalette => ({
  name: "Personalizado",
  primary,
  primaryDark: _mix(primary, [0, 0, 0], 0.42),
  primaryLight: tertiary || _mix(primary, [255, 255, 255], 0.22),
  accent,
  accentHover: _mix(accent, [0, 0, 0], 0.2),
  _tertiary: tertiary || null,
});

export type AppColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentHover: string;
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  danger: string;
  white: string;
  dark: boolean;
};

export function computeColors(presetKey?: string | null, custom?: BrandPalette | null, dark = false): AppColors {
  const palette = custom || THEME_PRESETS[presetKey || "navy_gold"] || THEME_PRESETS.navy_gold;
  const base = dark ? DARK_BASE : LIGHT_BASE;
  return {
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    primaryLight: palette.primaryLight,
    accent: palette.accent,
    accentHover: palette.accentHover,
    bg: base.bg,
    card: base.card,
    text: base.text,
    muted: base.muted,
    border: base.border,
    success: "#16A34A",
    danger: "#DC2626",
    white: "#FFFFFF",
    dark,
  };
}

// Static palette used on screens that render outside the provider (Auth, Reset).
export const STATIC_NAVY = computeColors("navy_gold", null, false);

// Local-storage key for the cached club branding (name + crest) shown on the
// login "portada" once a coach has configured their club.
export const BRAND_KEY = "futbase_brand";

type ThemeConfig = { theme_preset?: string | null; custom_colors?: BrandPalette | null; dark_mode?: boolean };

type AppThemeCtx = {
  colors: AppColors;
  setThemeFromConfig: (cfg: ThemeConfig) => void;
};

const AppThemeContext = createContext<AppThemeCtx>({ colors: STATIC_NAVY, setThemeFromConfig: () => {} });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<AppColors>(STATIC_NAVY);
  const setThemeFromConfig = useCallback((cfg: ThemeConfig) => {
    setColors(computeColors(cfg?.theme_preset, cfg?.custom_colors || null, !!cfg?.dark_mode));
  }, []);
  const value = useMemo(() => ({ colors, setThemeFromConfig }), [colors, setThemeFromConfig]);
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppColors(): AppColors {
  return useContext(AppThemeContext).colors;
}

export function useSetTheme() {
  return useContext(AppThemeContext).setThemeFromConfig;
}

export function useAppThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: AppColors) => T & StyleSheet.NamedStyles<any>,
): T {
  const colors = useAppColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
}
