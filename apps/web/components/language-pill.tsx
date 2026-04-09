"use client";

import { useUiText } from "./site-language-provider";
import styles from "./public-site.module.css";

export function LanguagePill() {
  const { locale, setLocale } = useUiText();

  return (
    <div className={styles.languagePill}>
      <button
        type="button"
        className={locale === "tr" ? styles.languagePillActive : undefined}
        onClick={() => setLocale("tr")}
      >
        TR
      </button>
      <button
        type="button"
        className={locale === "en" ? styles.languagePillActive : undefined}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}
