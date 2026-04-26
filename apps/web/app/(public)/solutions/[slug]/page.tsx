import { redirect } from "next/navigation";

export default async function SolutionDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  await params;
  redirect("/solutions");
}
