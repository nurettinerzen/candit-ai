"use client";

import { useEffect } from "react";
import { getBrandThemeAssets } from "./brand-assets";
import { useTheme } from "./theme-provider";

function upsertLink({
  id,
  rel,
  href,
  type,
  sizes
}: {
  id: string;
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
}) {
  const head = document.head;
  if (!head) {
    return;
  }

  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    head.appendChild(link);
  }

  link.rel = rel;
  link.href = href;

  if (type) {
    link.type = type;
  } else {
    link.removeAttribute("type");
  }

  if (sizes) {
    link.sizes = sizes;
  } else {
    link.removeAttribute("sizes");
  }
}

function upsertThemeColor(content: string) {
  const head = document.head;
  if (!head) {
    return;
  }

  let meta = document.getElementById("brand-theme-color") as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.id = "brand-theme-color";
    meta.name = "theme-color";
    head.appendChild(meta);
  }

  meta.content = content;
}

export function ThemeFaviconSync() {
  const { resolved } = useTheme();

  useEffect(() => {
    const assets = getBrandThemeAssets(resolved);

    upsertLink({
      id: "brand-favicon-svg",
      rel: "icon",
      href: assets.faviconSvg,
      type: "image/svg+xml"
    });
    upsertLink({
      id: "brand-favicon-ico",
      rel: "shortcut icon",
      href: assets.faviconIco,
      type: "image/x-icon"
    });
    upsertLink({
      id: "brand-apple-touch",
      rel: "apple-touch-icon",
      href: assets.appleTouch,
      type: "image/png",
      sizes: "180x180"
    });
    upsertThemeColor(assets.themeColor);
  }, [resolved]);

  return null;
}
