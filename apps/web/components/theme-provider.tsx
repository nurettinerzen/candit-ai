"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DOCUMENT_THEME_COLORS } from "../lib/design-tokens";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "ai_interviewer_theme";
const RESOLVED_THEME_COOKIE_KEY = "ai_interviewer_theme_resolved";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemPreference();
  return mode;
}

function normalizeThemeMode(raw: string | null | undefined): ThemeMode {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

function getInitialThemeMode() {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme-mode");
    if (attr) {
      return normalizeThemeMode(attr);
    }

    try {
      return normalizeThemeMode(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      return "system";
    }
  }

  return "system";
}

function getInitialResolvedTheme(mode: ThemeMode) {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") {
      return attr;
    }
  }

  return resolveTheme(mode);
}

function persistTheme(mode: ThemeMode, resolved: "light" | "dark") {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-mode", mode);
  document.documentElement.style.backgroundColor = DOCUMENT_THEME_COLORS[resolved].background;
  document.documentElement.style.colorScheme = resolved;

  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {}

  document.cookie = `${STORAGE_KEY}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.cookie = `${RESOLVED_THEME_COOKIE_KEY}=${resolved}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function ThemeProvider({
  children,
  initialMode,
  initialResolved
}: {
  children: ReactNode;
  initialMode?: ThemeMode;
  initialResolved?: "light" | "dark";
}) {
  const fallbackMode = initialMode ?? getInitialThemeMode();
  const fallbackResolved = initialResolved ?? getInitialResolvedTheme(fallbackMode);
  const [mode, setModeState] = useState<ThemeMode>(fallbackMode);
  const [resolved, setResolved] = useState<"light" | "dark">(fallbackResolved);

  useLayoutEffect(() => {
    const apply = () => {
      const nextResolved = resolveTheme(mode);
      setResolved(nextResolved);
      persistTheme(mode, nextResolved);
    };

    apply();

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    const normalized = normalizeThemeMode(nextMode);
    const nextResolved = resolveTheme(normalized);
    persistTheme(normalized, nextResolved);
    setResolved(nextResolved);
    setModeState(normalized);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, resolved }),
    [mode, setMode, resolved],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
