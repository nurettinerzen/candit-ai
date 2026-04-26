"use client";

import { BrandWordmark } from "./brand-wordmark";
import { useUiText } from "./site-language-provider";
import styles from "./public-site.module.css";
import { PUBLIC_FOOTER_COLUMNS } from "../lib/public-site-data";

export function SiteFooter() {
  const { t } = useUiText();

  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <a href="/" className={styles.brand} aria-label={t("Candit.ai ana sayfa")}>
              <BrandWordmark variant="publicFooter" decorative />
            </a>
            <span className={styles.footerLegal}>&copy; 2026 Candit.ai. {t("Tüm hakları saklıdır")}.</span>
          </div>

          {PUBLIC_FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className={styles.footerColumn}>
              <h3>{t(column.title)}</h3>
              <div className={styles.footerLinks}>
                {column.links.map((item) => (
                  <a key={item.href} href={item.href}>
                    {t(item.label)}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
