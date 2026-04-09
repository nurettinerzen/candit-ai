import { notFound } from "next/navigation";
import { PublicBlogArticlePage } from "../../../../components/public-site";
import { PUBLIC_BLOG_ARTICLES, getBlogArticleBySlug } from "../../../../lib/public-site-data";

export function generateStaticParams() {
  return PUBLIC_BLOG_ARTICLES.map((article) => ({
    slug: article.slug
  }));
}

export default async function BlogArticlePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!getBlogArticleBySlug(slug)) {
    notFound();
  }

  return <PublicBlogArticlePage slug={slug} />;
}
