import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";
import { SiteLanguageProvider } from "../components/site-language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Candit.ai",
  description: "AI destekli işe alım platformu"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ai_interviewer_theme");var r=t==="light"||t==="dark"?t:(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",r)}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <SiteLanguageProvider>{children}</SiteLanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
