import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Candit.ai",
    template: "%s | Candit.ai"
  },
  description: "Ön eleme, kaynak bulma ve mülakat süreçlerini AI ile hızlandırın. Aday değerlendirme ve işe alım akışlarını tek yerde yönetin."
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
