"use client";

import { useState } from "react";
import type { QuickActionType } from "../lib/types";

const ACTIONS: Array<{ key: QuickActionType; label: string; icon: string }> = [
  { key: "shortlist", label: "Kısa Listeye Al", icon: "★" },
  { key: "reject", label: "Reddet", icon: "✗" },
  { key: "hold", label: "Beklet", icon: "⏸" },
  { key: "trigger_screening", label: "Ön Eleme Başlat", icon: "🔍" },
  { key: "trigger_fit_score", label: "Uyum Skoru Hesapla", icon: "📊" },
  { key: "invite_interview", label: "Mülakat Daveti", icon: "📅" }
];

type QuickActionMenuProps = {
  onAction: (action: QuickActionType, reasonCode?: string) => void;
  disabled?: boolean;
};

export function QuickActionMenu({ onAction, disabled }: QuickActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="action-dropdown">
      <button className="btn btn-sm btn-secondary" onClick={() => setOpen(!open)} disabled={disabled}>
        İşlem ▾
      </button>
      {open && (
        <ul className="action-dropdown-menu">
          {ACTIONS.map((a) => (
            <li key={a.key}>
              <button
                className="action-dropdown-item"
                onClick={() => {
                  onAction(a.key);
                  setOpen(false);
                }}
              >
                <span className="action-dropdown-icon">{a.icon}</span>
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
