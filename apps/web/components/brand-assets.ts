export type ResolvedBrandTheme = "light" | "dark";

const BRAND_ICON_VERSION = "20260426d";

function versionedBrandAsset(path: string) {
  return `${path}?v=${BRAND_ICON_VERSION}`;
}

export const BRAND_THEME_ASSETS = {
  light: {
    wordmark: "/brand/candit-logo-clean-color.png",
    faviconPng: versionedBrandAsset("/brand/candit-favicon-light.png"),
    faviconIco: versionedBrandAsset("/brand/candit-favicon-light.ico"),
    appleTouch: versionedBrandAsset("/brand/candit-apple-touch-light.png"),
    themeColor: "#f8f9fb"
  },
  dark: {
    wordmark: "/brand/candit-logo-clean-hybrid-dark.png",
    faviconPng: versionedBrandAsset("/brand/candit-favicon-dark.png"),
    faviconIco: versionedBrandAsset("/brand/candit-favicon-dark.ico"),
    appleTouch: versionedBrandAsset("/brand/candit-apple-touch-dark.png"),
    themeColor: "#0b0d14"
  }
} as const satisfies Record<
  ResolvedBrandTheme,
  {
    wordmark: string;
    faviconPng: string;
    faviconIco: string;
    appleTouch: string;
    themeColor: string;
  }
>;

export function getBrandThemeAssets(theme: ResolvedBrandTheme) {
  return BRAND_THEME_ASSETS[theme];
}
