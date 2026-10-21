import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog";
import { getPublishedPosts } from "@/lib/blog";
import { siteConfig } from "@/lib/constants";
import { absoluteUrl, breadcrumbJsonLd, canonical, ogImages } from "@/lib/seo";
import { JsonLd } from "@/components/seo";

const POSTS_PER_PAGE = 9;

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>;
}

/**
 * Self-canonicalising per page.
 *
 * Pointing ?page=2 at /blog would tell Google page 2 is a duplicate of page 1,
 * which can stop the later pages being crawled. Each page therefore canonicals
 * to itself; page 1 canonicals to the clean /blog with no query string.
 */
export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const { page } = await searchParams;
  const pageNumber = Math.max(Number(page) || 1, 1);
  const path = pageNumber > 1 ? `/blog?page=${pageNumber}` : "/blog";
  const title = pageNumber > 1 ? `Blog - Page ${pageNumber}` : "Blog";
  const description = `News, style guides and updates from ${siteConfig.name}.`;

  return {
    // Bare title: the root layout's `%s | <store>` template adds the suffix.
    title,
    description,
    alternates: canonical(path),
    openGraph: {
      type: "website",
      title: `${title} | ${siteConfig.name}`,
      description,
      url: absoluteUrl(path),
      images: ogImages(),
    },
  };
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { page } = await searchParams;
  const posts = await getPublishedPosts();

  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const visible = posts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  return (
    <div className="container py-8 md:py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />

      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Blog</span>
      </nav>

      <header className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-bold md:text-4xl">Blog</h1>
        <p className="mt-3 text-muted-foreground">
          News, style guides and updates from {siteConfig.name}.
        </p>
      </header>

      {visible.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p>No posts published yet.</p>
          <Link href="/shop" className="mt-2 inline-block text-primary hover:underline">
            Browse products instead
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-center gap-3"
              aria-label="Blog pagination"
            >
              <Button variant="outline" size="sm" asChild disabled={currentPage === 1}>
                <Link
                  href={currentPage === 2 ? "/blog" : `/blog?page=${currentPage - 1}`}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                >
                  Previous
                </Link>
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button variant="outline" size="sm" asChild disabled={currentPage === totalPages}>
                <Link
                  href={`/blog?page=${currentPage + 1}`}
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                >
                  Next
                </Link>
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
