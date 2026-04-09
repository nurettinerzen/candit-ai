import type { Route } from "next";
import { redirect } from "next/navigation";

export default function LegacyReportsTurkishPage() {
  redirect("/reports" as Route);
}
