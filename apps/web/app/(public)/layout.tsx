import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Candit.ai",
    template: "%s | Candit.ai"
  },
  description: "AI destekli ise alim platformu. Mulakat, degerlendirme ve aday yonetimini otomatiklestirin."
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
