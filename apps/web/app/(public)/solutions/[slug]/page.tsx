import { notFound } from "next/navigation";
import { PublicSolutionDetailPage } from "../../../../components/public-site";
import { PUBLIC_SOLUTIONS, getSolutionBySlug } from "../../../../lib/public-site-data";

export function generateStaticParams() {
  return PUBLIC_SOLUTIONS.map((solution) => ({
    slug: solution.slug
  }));
}

export default async function SolutionDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!getSolutionBySlug(slug)) {
    notFound();
  }

  return <PublicSolutionDetailPage slug={slug} />;
}
