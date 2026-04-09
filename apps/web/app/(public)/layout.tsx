import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Candit.ai",
    template: "%s | Candit.ai"
  },
  description: "AI destekli işe alım platformu. Mülakat, değerlendirme ve aday yönetimini otomatikleştirin."
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
