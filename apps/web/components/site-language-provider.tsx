"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_STORAGE_KEY,
  normalizeSiteLocale,
  transformUiText,
  type SiteLocale
} from "../lib/i18n";
import { useTheme, type ThemeMode } from "./theme-provider";

type SiteLanguageContextValue = {
  locale: SiteLocale;
  setLocale: (nextLocale: SiteLocale) => void;
};

const SiteLanguageContext = createContext<SiteLanguageContextValue | null>(null);
const SKIP_TEXT_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "PRE", "CODE"]);
const TRANSFORMABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

type AttributeCache = Map<string, string>;

function isInSkippedTree(element: Element | null) {
  let current = element;
  while (current) {
    if (SKIP_TEXT_TAGS.has(current.tagName)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function resolveSourceValue(params: {
  cachedSource: string | undefined;
  currentValue: string;
  locale: SiteLocale;
  previousLocale: SiteLocale;
}) {
  const { cachedSource, currentValue, locale, previousLocale } = params;

  if (!cachedSource) {
    return currentValue;
  }

  if (locale === previousLocale) {
    const previousRendered = transformUiText(cachedSource, locale);
    if (previousRendered !== currentValue) {
      return currentValue;
    }
  }

  return cachedSource;
}

function applyLocaleToDocument(params: {
  locale: SiteLocale;
  previousLocale: SiteLocale;
  textSourceCache: WeakMap<Text, string>;
  attributeSourceCache: WeakMap<Element, AttributeCache>;
}) {
  const { locale, previousLocale, textSourceCache, attributeSourceCache } = params;

  if (typeof document === "undefined" || !document.body) {
    return;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  while (node) {
    const textNode = node as Text;
    const parentElement = textNode.parentElement;
    const currentValue = textNode.nodeValue ?? "";

    if (currentValue.trim().length > 0 && !isInSkippedTree(parentElement)) {
      const cachedSource = textSourceCache.get(textNode);
      const sourceValue = resolveSourceValue({
        cachedSource,
        currentValue,
        locale,
        previousLocale
      });
      textSourceCache.set(textNode, sourceValue);

      const transformedValue = transformUiText(sourceValue, locale);
      if (transformedValue !== currentValue) {
        textNode.nodeValue = transformedValue;
      }
    }

    node = walker.nextNode();
  }

  const selector = TRANSFORMABLE_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(",");
  const elements = Array.from(document.querySelectorAll(selector));

  for (const element of elements) {
    if (isInSkippedTree(element)) {
      continue;
    }

    let attributeCache = attributeSourceCache.get(element);
    if (!attributeCache) {
      attributeCache = new Map<string, string>();
      attributeSourceCache.set(element, attributeCache);
    }

    for (const attribute of TRANSFORMABLE_ATTRIBUTES) {
      const currentValue = element.getAttribute(attribute);
      if (currentValue === null) {
        continue;
      }

      const sourceValue = resolveSourceValue({
        cachedSource: attributeCache.get(attribute),
        currentValue,
        locale,
        previousLocale
      });
      attributeCache.set(attribute, sourceValue);

      const transformedValue = transformUiText(sourceValue, locale);
      if (transformedValue !== currentValue) {
        element.setAttribute(attribute, transformedValue);
      }
    }
  }
}

const THEME_OPTIONS: { mode: ThemeMode; icon: string }[] = [
  { mode: "light", icon: "☀️" },
  { mode: "dark", icon: "🌙" },
  { mode: "system", icon: "💻" },
];

const TOOLBAR_LABELS: Record<
  SiteLocale,
  {
    settings: string;
    language: string;
    theme: Record<ThemeMode, string>;
  }
> = {
  tr: {
    settings: "Ayarlar",
    language: "Dil",
    theme: {
      light: "Açık",
      dark: "Koyu",
      system: "Sistem"
    }
  },
  en: {
    settings: "Settings",
    language: "Language",
    theme: {
      light: "Light",
      dark: "Dark",
      system: "System"
    }
  }
};

export function SiteSettingsSwitcher({ variant = "floating" }: { variant?: "floating" | "sidebar" }) {
  const language = useSiteLanguage();
  const theme = useTheme();
  const labels = TOOLBAR_LABELS[language.locale];
  const selectId = variant === "sidebar" ? "site-language-select-sidebar" : "site-language-select";

  return (
    <div
      className={`language-switcher${variant === "sidebar" ? " language-switcher-sidebar" : ""}`}
      role="group"
      aria-label={labels.settings}
    >
      <div className={`theme-switcher${variant === "sidebar" ? " theme-switcher-sidebar" : ""}`}>
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            className={`theme-btn${variant === "sidebar" ? " theme-btn-sidebar" : ""}`}
            data-active={theme.mode === opt.mode}
            onClick={() => theme.setMode(opt.mode)}
            title={labels.theme[opt.mode]}
            aria-label={labels.theme[opt.mode]}
          >
            {opt.icon}
          </button>
        ))}
      </div>
      <label htmlFor={selectId} className="language-switcher-label">
        {labels.language}
      </label>
      <select
        id={selectId}
        className={`language-switcher-select${variant === "sidebar" ? " language-switcher-select-sidebar" : ""}`}
        value={language.locale}
        onChange={(event) => language.setLocale(normalizeSiteLocale(event.target.value))}
      >
        <option value="tr">TR</option>
        <option value="en">EN</option>
      </select>
    </div>
  );
}

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>(DEFAULT_SITE_LOCALE);
  const textSourceCacheRef = useRef<WeakMap<Text, string>>(new WeakMap());
  const attributeSourceCacheRef = useRef<WeakMap<Element, AttributeCache>>(new WeakMap());
  const previousLocaleRef = useRef<SiteLocale>(DEFAULT_SITE_LOCALE);
  const isApplyingLocaleRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedLocale = normalizeSiteLocale(window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY));
    setLocaleState(storedLocale);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = locale;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) {
      return;
    }

    const runTransform = () => {
      if (isApplyingLocaleRef.current) {
        return;
      }

      isApplyingLocaleRef.current = true;
      try {
        applyLocaleToDocument({
          locale,
          previousLocale: previousLocaleRef.current,
          textSourceCache: textSourceCacheRef.current,
          attributeSourceCache: attributeSourceCacheRef.current
        });
        previousLocaleRef.current = locale;
      } finally {
        isApplyingLocaleRef.current = false;
      }
    };

    runTransform();

    const observer = new MutationObserver(() => {
      if (isApplyingLocaleRef.current) {
        return;
      }

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        runTransform();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSFORMABLE_ATTRIBUTES as unknown as string[]
    });

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [locale]);

  const contextValue = useMemo<SiteLanguageContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale: SiteLocale) => setLocaleState(normalizeSiteLocale(nextLocale))
    }),
    [locale]
  );

  return (
    <SiteLanguageContext.Provider value={contextValue}>
      {children}
    </SiteLanguageContext.Provider>
  );
}

export function useSiteLanguage() {
  const value = useContext(SiteLanguageContext);
  if (!value) {
    throw new Error("useSiteLanguage must be used inside SiteLanguageProvider");
  }

  return value;
}
