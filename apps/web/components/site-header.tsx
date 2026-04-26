"use client";

import { BrandWordmark } from "./brand-wordmark";
import { useUiText } from "./site-language-provider";
import styles from "./public-site.module.css";
import { LanguagePill } from "./language-pill";
import { PUBLIC_TOP_NAV } from "../lib/public-site-data";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SiteHeader({ activeHref }: { activeHref?: string }) {
  const { t } = useUiText();

  return (
    <header className={styles.header}>
      <div className={cn(styles.shell, styles.headerInner)}>
        <a href="/" className={styles.brand} aria-label={t("Candit.ai ana sayfa")}>
          <BrandWordmark variant="publicHeader" decorative />
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
            {t("Giriş")}
          </a>
          <a
            href="/auth/signup"
            className={cn(styles.button, styles.buttonPrimary)}
          >
            <span>{t("Ücretsiz deneme")}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
