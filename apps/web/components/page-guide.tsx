"use client";

import type { CSSProperties, ElementType } from "react";
import { getLocalizedGuideText, getPanelGuideEntry, type PanelGuideKey } from "../lib/panel-guides";
import { useUiText } from "./site-language-provider";

export function InfoHint(props: {
  label: string;
  content: string;
}) {
  return (
    <span className="app-info">
      <button
        type="button"
        className="app-info-trigger"
        aria-label={props.label}
      >
        i
      </button>
      <span className="app-info-tooltip" role="tooltip">
        {props.content}
      </span>
    </span>
  );
}

type PageTitleWithGuideProps<T extends ElementType> = {
  as?: T;
  guideKey: PanelGuideKey;
  title: string;
  className?: string;
  style?: CSSProperties;
};

export function PageTitleWithGuide<T extends ElementType = "h1">(
  props: PageTitleWithGuideProps<T>
) {
  const { locale } = useUiText();
  const guide = getPanelGuideEntry(props.guideKey);
  const Tag = (props.as ?? "h1") as ElementType;
  const infoLabel =
    locale === "en" ? `${props.title} page information` : `${props.title} sayfa bilgisi`;

  return (
    <div className="page-title-row">
      <Tag className={props.className} style={props.style}>
        {props.title}
      </Tag>
      <InfoHint
        label={infoLabel}
        content={getLocalizedGuideText(guide.summary, locale)}
      />
    </div>
  );
}
