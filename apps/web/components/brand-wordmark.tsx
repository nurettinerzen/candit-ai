"use client";

import { getBrandThemeAssets, type ResolvedBrandTheme } from "./brand-assets";
import { useTheme } from "./theme-provider";
import styles from "./brand-wordmark.module.css";

type BrandWordmarkVariant = "publicHeader" | "publicFooter" | "marketing" | "auth" | "sidebar";

type BrandWordmarkProps = {
  variant: BrandWordmarkVariant;
  className?: string;
  alt?: string;
  decorative?: boolean;
  forceTheme?: ResolvedBrandTheme;
};

const BRAND_DIMENSIONS: Record<BrandWordmarkVariant, { width: number; height: number }> = {
  publicHeader: { width: 150, height: 67 },
  publicFooter: { width: 165, height: 74 },
  marketing: { width: 155, height: 70 },
  auth: { width: 165, height: 74 },
  sidebar: { width: 145, height: 66 }
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function BrandWordmark({
  variant,
  className,
  alt = "Candit.ai",
  decorative = false,
  forceTheme
}: BrandWordmarkProps) {
  const { resolved } = useTheme();
  const brandTheme = forceTheme ?? resolved;
  const src = getBrandThemeAssets(brandTheme).wordmark;
  const dimensions = BRAND_DIMENSIONS[variant];

  return (
    <img
      src={src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? "true" : undefined}
      width={dimensions.width}
      height={dimensions.height}
      className={cn(styles.wordmark, styles[variant], className)}
    />
  );
}
