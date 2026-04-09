import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Telyx.ai",
    template: "%s | Telyx.ai"
  },
  description: "Telyx public marketing experience cloned into this project."
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
