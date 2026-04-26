export type ResolvedBrandTheme = "light" | "dark";

export const BRAND_THEME_ASSETS = {
  light: {
    wordmark: "/brand/candit-logo-clean-color.png",
    faviconSvg: "/brand/candit-favicon-light.svg",
    faviconIco: "/brand/candit-favicon-light.ico",
    appleTouch: "/brand/candit-apple-touch-light.png",
    themeColor: "#f8f9fb"
  },
  dark: {
    wordmark: "/brand/candit-logo-clean-hybrid-dark.png",
    faviconSvg: "/brand/candit-favicon-dark.svg",
    faviconIco: "/brand/candit-favicon-dark.ico",
    appleTouch: "/brand/candit-apple-touch-dark.png",
    themeColor: "#0b0d14"
  }
} as const satisfies Record<
  ResolvedBrandTheme,
  {
    wordmark: string;
    faviconSvg: string;
    faviconIco: string;
    appleTouch: string;
    themeColor: string;
  }
>;

export function getBrandThemeAssets(theme: ResolvedBrandTheme) {
  return BRAND_THEME_ASSETS[theme];
}
