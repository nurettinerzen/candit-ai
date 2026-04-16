"use client";

import { useUiText } from "./site-language-provider";
import styles from "./public-site.module.css";
import { PUBLIC_FOOTER_COLUMNS, PUBLIC_SITE_BRAND_SUBTITLE } from "../lib/public-site-data";

const SITE_BRAND = "Candit.ai";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SiteFooter() {
  const { t } = useUiText();

  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <a href="/" className={styles.brand}>
              <span className={styles.brandMark}>
                <img src="/brand/candit-mark.svg" alt="" aria-hidden="true" width="40" height="40" />
              </span>
              <span className={styles.brandCopy}>
                <strong>{SITE_BRAND}</strong>
                <span>{t(PUBLIC_SITE_BRAND_SUBTITLE)}</span>
              </span>
            </a>
            <p className={styles.footerCopy}>
              {t("Ön eleme, kaynak bulma ve mülakat süreçlerini yapay zekâ ile otomatikleştirin. Doğru adayı daha hızlı bulun.")}
            </p>
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

        <div className={styles.footerBottom}>
          <span>&copy; 2026 {SITE_BRAND}. {t("Tüm hakları saklıdır")}.</span>
          <div className={styles.footerBottomLinks}>
            <a href="/privacy">{t("Gizlilik")}</a>
            <a href="/terms">{t("Kullanım Koşulları")}</a>
            <a href="/contact">{t("İletişim")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
