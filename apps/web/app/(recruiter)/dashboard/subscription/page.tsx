import type { Route } from "next";
import { redirect } from "next/navigation";

export default function DashboardSubscriptionAliasPage() {
  redirect("/subscription" as Route);
}
