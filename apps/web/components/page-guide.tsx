"use client";

import type { CSSProperties, ElementType, ReactNode } from "react";
import {
  getLocalizedGuideItems,
  getLocalizedGuideSteps,
  getLocalizedGuideText,
  getPanelGuideEntry,
  type PanelGuideKey
} from "../lib/panel-guides";
import { useUiText } from "./site-language-provider";

function InfoIcon(props: {
  className?: string;
}) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v5" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

export function InfoHint(props: {
  label: string;
  content: ReactNode;
  variant?: "compact" | "page";
}) {
  const isPageGuide = props.variant === "page";

  return (
    <span className={isPageGuide ? "page-guide" : "app-info"}>
      <button
        type="button"
        className={isPageGuide ? "page-guide-trigger" : "app-info-trigger"}
        aria-label={props.label}
        aria-haspopup="true"
      >
        <InfoIcon className={isPageGuide ? "page-guide-icon" : "app-info-icon"} />
      </button>
      <span className={isPageGuide ? "page-guide-tooltip" : "app-info-tooltip"} role="tooltip">
        {props.content}
      </span>
    </span>
  );
}

type PageTitleWithGuideProps<T extends ElementType> = {
  as?: T;
  guideKey: PanelGuideKey;
  title: string;
  subtitle?: string;
  subtitleClassName?: string;
  subtitleStyle?: CSSProperties;
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
  const guideHighlights = getLocalizedGuideItems(guide.highlights, locale);
  const guideSteps = getLocalizedGuideSteps(props.guideKey, locale);
  const guideSummary = getLocalizedGuideText(guide.summary, locale);
  const guideCard = (
    <div className="page-guide-card">
      <div className="page-guide-card-header">
        <span className="page-guide-card-kicker">
          {locale === "en" ? "Page guide" : "Sayfa rehberi"}
        </span>
      </div>
      <p className="page-guide-card-summary">{guideSummary}</p>
      <ul className="page-guide-card-list">
        {guideHighlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="page-guide-card-divider" />
      <div className="page-guide-card-footer">
        <span className="page-guide-card-kicker">
          {locale === "en" ? "Quick steps on this page" : "Bu sayfada hızlı adımlar"}
        </span>
        <ol className="page-guide-card-steps">
          {guideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );

  if (props.subtitle) {
    return (
      <div className="page-title-block">
        <Tag className={props.className} style={props.style}>
          {props.title}
        </Tag>
        <div className="page-title-subline">
          <p className={props.subtitleClassName} style={props.subtitleStyle}>
            {props.subtitle}
          </p>
          <InfoHint label={infoLabel} content={guideCard} variant="page" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-title-row">
      <Tag className={props.className} style={props.style}>
        {props.title}
      </Tag>
      <InfoHint label={infoLabel} content={guideCard} variant="page" />
    </div>
  );
}
