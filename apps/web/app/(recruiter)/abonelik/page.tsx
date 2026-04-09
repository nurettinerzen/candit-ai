import type { Route } from "next";
import { redirect } from "next/navigation";

export default function LegacySubscriptionTurkishPage() {
  redirect("/subscription" as Route);
}
