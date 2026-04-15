"use client";

import { useState, useRef, useEffect } from "react";
import { useUiText } from "./site-language-provider";
import styles from "./public-site.module.css";

const LANGUAGES = [
  { code: "tr" as const, label: "Türkçe", flag: "TR" },
  { code: "en" as const, label: "English", flag: "EN" }
];

export function LanguagePill() {
  const { locale, setLocale, t } = useUiText();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const localeLabels =
    locale === "tr"
      ? { tr: "Türkçe", en: "English" }
      : { tr: "Turkish", en: "English" };

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  return (
    <div className={styles.langDropdown} ref={ref} data-no-translate="">
      <button
        type="button"
        className={styles.langDropdownTrigger}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t("Dil")}: TR / EN`}
        data-open={open ? "true" : "false"}
      >
        <span className={styles.langDropdownTriggerIcon} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.25"/>
            <path d="M8 1.75C8 1.75 5.5 4.75 5.5 8s2.5 6.25 2.5 6.25"/>
            <path d="M8 1.75C8 1.75 10.5 4.75 10.5 8S8 14.25 8 14.25"/>
            <path d="M1.75 8h12.5"/>
          </svg>
        </span>
        <span className={styles.langDropdownTriggerLabel}>TR / EN</span>
      </button>

      {open ? (
        <div className={styles.langDropdownMenu} role="menu" aria-label={t("Dil")}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`${styles.langDropdownItem}${lang.code === locale ? ` ${styles.langDropdownItemActive}` : ""}`}
              onClick={() => { setLocale(lang.code); setOpen(false); }}
              role="menuitemradio"
              aria-checked={lang.code === locale}
            >
              <span className={styles.langDropdownItemFlag}>{lang.flag}</span>
              <span className={styles.langDropdownItemLabel}>{localeLabels[lang.code]}</span>
              {lang.code === locale ? (
                <svg className={styles.langDropdownItemCheck} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.25 2.5 2.5 6-6" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
