"use client";

import {
  createContext,
  useEffect,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_STORAGE_KEY,
  normalizeSiteLocale,
  translateUiText,
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
const TRANSFORMABLE_ATTRIBUTES_SELECTOR = TRANSFORMABLE_ATTRIBUTES.map(
  (attribute) => `[${attribute}]`
).join(",");
const LOCALE_READY_ATTRIBUTE = "data-locale-ready";
const SKIP_TRANSLATION_ATTRIBUTE = "data-no-translate";

type AttributeCache = Map<string, string>;

function isInSkippedTree(element: Element | null) {
  let current = element;
  while (current) {
    if (SKIP_TEXT_TAGS.has(current.tagName)) {
      return true;
    }
    if (current.hasAttribute(SKIP_TRANSLATION_ATTRIBUTE)) {
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

function applyLocaleToTextNode(params: {
  locale: SiteLocale;
  previousLocale: SiteLocale;
  textSourceCache: WeakMap<Text, string>;
  textNode: Text;
}) {
  const { locale, previousLocale, textSourceCache, textNode } = params;
  const parentElement = textNode.parentElement;
  const currentValue = textNode.nodeValue ?? "";

  if (currentValue.trim().length === 0 || isInSkippedTree(parentElement)) {
    return;
  }

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

function applyLocaleToAttributes(params: {
  locale: SiteLocale;
  previousLocale: SiteLocale;
  attributeSourceCache: WeakMap<Element, AttributeCache>;
  element: Element;
}) {
  const { locale, previousLocale, attributeSourceCache, element } = params;

  if (isInSkippedTree(element)) {
    return;
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

function applyLocaleToElementTree(params: {
  locale: SiteLocale;
  previousLocale: SiteLocale;
  textSourceCache: WeakMap<Text, string>;
  attributeSourceCache: WeakMap<Element, AttributeCache>;
  root: Element;
}) {
  const { locale, previousLocale, textSourceCache, attributeSourceCache, root } = params;

  if (typeof document === "undefined" || isInSkippedTree(root)) {
    return;
  }

  applyLocaleToAttributes({
    locale,
    previousLocale,
    attributeSourceCache,
    element: root
  });

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = textWalker.nextNode();

  while (textNode) {
    applyLocaleToTextNode({
      locale,
      previousLocale,
      textSourceCache,
      textNode: textNode as Text
    });
    textNode = textWalker.nextNode();
  }

  const descendants = Array.from(root.querySelectorAll(TRANSFORMABLE_ATTRIBUTES_SELECTOR));
  for (const element of descendants) {
    applyLocaleToAttributes({
      locale,
      previousLocale,
      attributeSourceCache,
      element
    });
  }
}

function applyLocaleToNode(params: {
  locale: SiteLocale;
  previousLocale: SiteLocale;
  textSourceCache: WeakMap<Text, string>;
  attributeSourceCache: WeakMap<Element, AttributeCache>;
  node: Node;
}) {
  const { node, locale, previousLocale, textSourceCache, attributeSourceCache } = params;

  if (node.nodeType === Node.TEXT_NODE) {
    applyLocaleToTextNode({
      locale,
      previousLocale,
      textSourceCache,
      textNode: node as Text
    });
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    applyLocaleToElementTree({
      locale,
      previousLocale,
      textSourceCache,
      attributeSourceCache,
      root: node as Element
    });
  }
}

function applyLocaleToDocument(params: {
  locale: SiteLocale;
  previousLocale: SiteLocale;
  textSourceCache: WeakMap<Text, string>;
  attributeSourceCache: WeakMap<Element, AttributeCache>;
}) {
  if (typeof document === "undefined" || !document.body) {
    return;
  }

  applyLocaleToElementTree({
    ...params,
    root: document.body
  });
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

export function SiteSettingsSwitcher({
  variant = "floating"
}: {
  variant?: "floating" | "sidebar" | "account";
}) {
  const language = useSiteLanguage();
  const theme = useTheme();
  const labels = TOOLBAR_LABELS[language.locale];
  const selectId =
    variant === "sidebar"
      ? "site-language-select-sidebar"
      : variant === "account"
        ? "site-language-select-account"
        : "site-language-select";

  return (
    <div
      className={`language-switcher${
        variant === "sidebar"
          ? " language-switcher-sidebar"
          : variant === "account"
            ? " language-switcher-account"
            : ""
      }`}
      role="group"
      aria-label={labels.settings}
    >
      <div
        className={`theme-switcher${
          variant === "sidebar"
            ? " theme-switcher-sidebar"
            : variant === "account"
              ? " theme-switcher-account"
              : ""
        }`}
      >
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            className={`theme-btn${
              variant === "sidebar"
                ? " theme-btn-sidebar"
                : variant === "account"
                  ? " theme-btn-account"
                  : ""
            }`}
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
        className={`language-switcher-select${
          variant === "sidebar"
            ? " language-switcher-select-sidebar"
            : variant === "account"
              ? " language-switcher-select-account"
              : ""
        }`}
        value={language.locale}
        onChange={(event) => language.setLocale(normalizeSiteLocale(event.target.value))}
      >
        <option value="tr">TR</option>
        <option value="en">EN</option>
      </select>
    </div>
  );
}

function getInitialLocale(): SiteLocale {
  if (typeof document !== "undefined") {
    // Read from data-locale attribute set by blocking <script> in layout.tsx
    const attr = document.documentElement.getAttribute("data-locale");
    if (attr) return normalizeSiteLocale(attr);

    try {
      return normalizeSiteLocale(window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY));
    } catch {
      return DEFAULT_SITE_LOCALE;
    }
  }
  return DEFAULT_SITE_LOCALE;
}

function persistLocale(locale: SiteLocale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.setAttribute("data-locale", locale);

  try {
    window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
  } catch {}

  document.cookie = `${SITE_LOCALE_STORAGE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function SiteLanguageProvider({
  children,
  initialLocale
}: {
  children: ReactNode;
  initialLocale?: SiteLocale;
}) {
  const fallbackLocale = initialLocale ?? getInitialLocale();
  const [locale, setLocaleState] = useState<SiteLocale>(fallbackLocale);
  const textSourceCacheRef = useRef<WeakMap<Text, string>>(new WeakMap());
  const attributeSourceCacheRef = useRef<WeakMap<Element, AttributeCache>>(new WeakMap());
  const previousLocaleRef = useRef<SiteLocale>(fallbackLocale);
  const isApplyingLocaleRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    persistLocale(locale);
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
        document.documentElement.setAttribute(LOCALE_READY_ATTRIBUTE, "true");
      } finally {
        isApplyingLocaleRef.current = false;
      }
    };

    runTransform();

    if (locale === DEFAULT_SITE_LOCALE) {
      return;
    }

    const pendingNodes = new Set<Node>();

    const mutationObserver = new MutationObserver((mutations) => {
      if (isApplyingLocaleRef.current) {
        return;
      }

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => pendingNodes.add(node));
          continue;
        }

        pendingNodes.add(mutation.target);
      }

      if (pendingNodes.size === 0) {
        return;
      }

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingNodes.size === 0) {
          return;
        }

        isApplyingLocaleRef.current = true;
        try {
          for (const node of pendingNodes) {
            applyLocaleToNode({
              locale,
              previousLocale: previousLocaleRef.current,
              textSourceCache: textSourceCacheRef.current,
              attributeSourceCache: attributeSourceCacheRef.current,
              node
            });
          }
          document.documentElement.setAttribute(LOCALE_READY_ATTRIBUTE, "true");
        } finally {
          pendingNodes.clear();
          isApplyingLocaleRef.current = false;
        }
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSFORMABLE_ATTRIBUTES as unknown as string[]
    });

    return () => {
      mutationObserver.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [locale]);

  const contextValue = useMemo<SiteLanguageContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale: SiteLocale) => {
        const normalized = normalizeSiteLocale(nextLocale);
        persistLocale(normalized);
        setLocaleState(normalized);
      }
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

export function useUiText() {
  const { locale, setLocale } = useSiteLanguage();

  return useMemo(
    () => ({
      locale,
      setLocale,
      t: (value: string) => translateUiText(value, locale)
    }),
    [locale, setLocale]
  );
}
