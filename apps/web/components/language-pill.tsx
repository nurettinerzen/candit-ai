"use client";

import { useState, useRef, useEffect } from "react";
import { useUiText } from "./site-language-provider";
import styles from "./public-site.module.css";

const LANGUAGES = [
  { code: "tr" as const, label: "Türkçe", flag: "TR" },
  { code: "en" as const, label: "English", flag: "EN" }
];

const DEFAULT_LANGUAGE = { code: "tr" as const, label: "Türkçe", flag: "TR" };

export function LanguagePill() {
  const { locale, setLocale } = useUiText();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = LANGUAGES.find((l) => l.code === locale) ?? DEFAULT_LANGUAGE;

  return (
    <div className={styles.langDropdown} ref={ref}>
      <button
        type="button"
        className={styles.langDropdownTrigger}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className={styles.langDropdownFlag}>{current.flag}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className={styles.langDropdownMenu}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`${styles.langDropdownItem}${lang.code === locale ? ` ${styles.langDropdownItemActive}` : ""}`}
              onClick={() => { setLocale(lang.code); setOpen(false); }}
            >
              <span className={styles.langDropdownItemFlag}>{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === locale ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
