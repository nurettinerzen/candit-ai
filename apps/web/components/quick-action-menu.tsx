"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ApplicationStage, QuickActionType } from "../lib/types";
import { getStageActions, type StageAction } from "../lib/constants";
import { useUiText } from "./site-language-provider";

type QuickActionMenuProps = {
  stage: ApplicationStage;
  actions?: StageAction[];
  onAction: (action: QuickActionType, reasonCode?: string) => void;
  disabled?: boolean;
};

export function QuickActionMenu({ stage, actions: providedActions, onAction, disabled }: QuickActionMenuProps) {
  const { t } = useUiText();
  const actions = providedActions ?? getStageActions(stage);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 190
  });

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const estimatedHeight = actions.length * 40 + 20;
      const minWidth = Math.max(210, Math.round(rect.width + 92));
      const left = Math.max(12, rect.right - minWidth);
      const preferredTop = rect.bottom + 6;
      const top = preferredTop + estimatedHeight <= window.innerHeight - 12
        ? preferredTop
        : Math.max(12, rect.top - estimatedHeight - 6);

      setMenuStyle({ top, left, minWidth });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, actions.length]);

  if (actions.length === 0) {
    return <span className="text-muted text-sm">—</span>;
  }

  return (
    <div className="action-dropdown" ref={rootRef}>
      <button
        type="button"
        className="action-dropdown-trigger"
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
      >
        <span>{t("İşlem")}</span>
        <span className="action-dropdown-caret" aria-hidden="true">▾</span>
      </button>
      {open && createPortal(
        <ul
          className="action-dropdown-menu action-dropdown-menu-portal"
          ref={menuRef}
          style={{
            top: `${menuStyle.top}px`,
            left: `${menuStyle.left}px`,
            minWidth: `${menuStyle.minWidth}px`
          }}
        >
          {actions.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                className="action-dropdown-item"
                onClick={() => {
                  onAction(a.key as QuickActionType);
                  setOpen(false);
                }}
                style={{ color: a.color }}
              >
                <span className="action-dropdown-icon">{a.icon}</span>
                {t(a.label)}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
