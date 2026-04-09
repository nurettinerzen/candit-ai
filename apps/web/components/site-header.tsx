"use client";

import { useUiText } from "./site-language-provider";
import styles from "./public-site.module.css";
import { LanguagePill } from "./language-pill";
import { PUBLIC_TOP_NAV } from "../lib/public-site-data";

const SITE_BRAND = "Candit.ai";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SiteHeader({ activeHref }: { activeHref?: string }) {
  const { t } = useUiText();

  return (
    <header className={styles.header}>
      <div className={cn(styles.shell, styles.headerInner)}>
        <a href="/" className={styles.brand} aria-label={t("Candit.ai ana sayfa")}>
          <span className={styles.brandMark}>
            <img src="/brand/candit-mark.svg" alt="" aria-hidden="true" width="40" height="40" />
          </span>
          <span className={styles.brandCopy}>
            <strong>{SITE_BRAND}</strong>
            <span>{t("AI destekli işe alım platformu")}</span>
          </span>
        </a>

        <nav className={styles.nav} aria-label={t("Genel gezinme")}>
          {PUBLIC_TOP_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(styles.navLink, activeHref === item.href && styles.navLinkActive)}
            >
              {t(item.label)}
            </a>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <LanguagePill />
          <a href="/auth/login" className={styles.headerTextAction}>
            {t("Giriş Yap")}
          </a>
          <a
            href="/auth/signup"
            className={cn(styles.button, styles.buttonPrimary)}
          >
            <span>{t("Ücretsiz Deneyin")}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
