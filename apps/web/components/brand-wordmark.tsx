"use client";

import { getBrandThemeAssets } from "./brand-assets";
import { useTheme } from "./theme-provider";
import styles from "./brand-wordmark.module.css";

type BrandWordmarkVariant = "publicHeader" | "publicFooter" | "marketing" | "auth" | "sidebar";

type BrandWordmarkProps = {
  variant: BrandWordmarkVariant;
  className?: string;
  alt?: string;
  decorative?: boolean;
};

const BRAND_DIMENSIONS: Record<BrandWordmarkVariant, { width: number; height: number }> = {
  publicHeader: { width: 165, height: 74 },
  publicFooter: { width: 165, height: 74 },
  marketing: { width: 165, height: 74 },
  auth: { width: 165, height: 74 },
  sidebar: { width: 165, height: 74 }
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function BrandWordmark({
  variant,
  className,
  alt = "Candit.ai",
  decorative = false
}: BrandWordmarkProps) {
  const { resolved } = useTheme();
  const src = getBrandThemeAssets(resolved).wordmark;
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
