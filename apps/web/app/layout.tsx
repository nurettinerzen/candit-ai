import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JetBrains_Mono, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";
import { SiteLanguageProvider } from "../components/site-language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Candit.ai",
  description: "Ön eleme, kaynak bulma ve mülakat süreçlerini AI ile hızlandırın."
};

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans-loaded",
  display: "swap"
});

const monoFont = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
  display: "swap"
});

const serifFont = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif-loaded",
  display: "swap"
});

const THEME_STORAGE_KEY = "ai_interviewer_theme";
const THEME_RESOLVED_COOKIE_KEY = "ai_interviewer_theme_resolved";
const SITE_LOCALE_STORAGE_KEY = "ai_interviewer_site_locale";

function normalizeThemeMode(raw: string | undefined) {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

function normalizeResolvedTheme(raw: string | undefined, mode: string) {
  if (raw === "light" || raw === "dark") {
    return raw;
  }

  return mode === "dark" ? "dark" : "light";
}

function normalizeLocale(raw: string | undefined) {
  return raw === "en" ? "en" : "tr";
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const initialThemeMode = normalizeThemeMode(cookieStore.get(THEME_STORAGE_KEY)?.value);
  const initialResolvedTheme = normalizeResolvedTheme(
    cookieStore.get(THEME_RESOLVED_COOKIE_KEY)?.value,
    initialThemeMode
  );
  const initialLocale = normalizeLocale(cookieStore.get(SITE_LOCALE_STORAGE_KEY)?.value);

  return (
    <html
      className={`${sansFont.variable} ${monoFont.variable} ${serifFont.variable}`}
      lang={initialLocale}
      data-locale={initialLocale}
      data-locale-ready="true"
      data-theme={initialResolvedTheme}
      data-theme-mode={initialThemeMode}
      style={{
        backgroundColor: initialResolvedTheme === "dark" ? "#0b0d14" : "#f8f9fb",
        colorScheme: initialResolvedTheme
      }}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;function c(name){var m=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/([.$?*|{}()\\[\\]\\\\/+^])/g,'\\\\$1')+'=([^;]*)'));return m?decodeURIComponent(m[1]):null}var t=d.getAttribute("data-theme-mode")||c("ai_interviewer_theme")||localStorage.getItem("ai_interviewer_theme")||"system";if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var r=d.getAttribute("data-theme")||c("ai_interviewer_theme_resolved");if(r!=="light"&&r!=="dark"){r=t==="light"||t==="dark"?t:(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light")}d.setAttribute("data-theme",r);d.setAttribute("data-theme-mode",t);d.style.backgroundColor=r==="dark"?"#0b0d14":"#f8f9fb";d.style.colorScheme=r;var l=d.getAttribute("data-locale")||c("ai_interviewer_site_locale")||localStorage.getItem("ai_interviewer_site_locale")||"tr";if(l!=="tr"&&l!=="en")l="tr";d.setAttribute("data-locale",l);d.setAttribute("data-locale-ready","true");d.lang=l;document.cookie="ai_interviewer_theme="+t+"; Path=/; Max-Age=31536000; SameSite=Lax";document.cookie="ai_interviewer_theme_resolved="+r+"; Path=/; Max-Age=31536000; SameSite=Lax";document.cookie="ai_interviewer_site_locale="+l+"; Path=/; Max-Age=31536000; SameSite=Lax";try{localStorage.setItem("ai_interviewer_theme",t);localStorage.setItem("ai_interviewer_site_locale",l)}catch(e){}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider
          initialMode={initialThemeMode}
          initialResolved={initialResolvedTheme}
        >
          <SiteLanguageProvider initialLocale={initialLocale}>
            {children}
          </SiteLanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
