import type { Route } from "next";
import { redirect } from "next/navigation";

export default function LegacyAdminTurkishPage() {
  redirect("/admin" as Route);
}
