import type { Route } from "next";
import { redirect } from "next/navigation";

export default function LegacyTeamTurkishPage() {
  redirect("/team" as Route);
}
