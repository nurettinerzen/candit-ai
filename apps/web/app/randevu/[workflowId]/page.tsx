import type { Route } from "next";
import { redirect } from "next/navigation";

export default async function LegacyScheduleTurkishPage({
  params,
  searchParams
}: {
  params: Promise<{ workflowId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workflowId } = await params;
  const query = new URLSearchParams();
  const resolvedSearchParams = await searchParams;

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      query.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      query.append(key, item);
    }
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`/schedule/${encodeURIComponent(workflowId)}${suffix}` as Route);
}
