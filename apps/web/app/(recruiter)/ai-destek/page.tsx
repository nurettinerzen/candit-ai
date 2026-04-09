import type { Route } from "next";
import { redirect } from "next/navigation";

export default function LegacyAiSupportTurkishPage() {
  redirect("/ai-support" as Route);
}
