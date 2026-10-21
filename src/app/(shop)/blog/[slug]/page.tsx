import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight } from "lucide-react";
import { getPublishedPostBySlug, getRelatedPosts } from "@/lib/blog";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { PostCard, formatPostDate } from "@/components/blog";
import { siteConfig } from "@/lib/constants";
import {
  absoluteImageUrl,
  absoluteUrl,
  breadcrumbJsonLd,
  canonical,
  ogImages,
} from "@/lib/seo";
import { JsonLd } from "@/components/seo";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found", robots: { index: false, follow: false } };
  }

  // Admin SEO overrides win; otherwise derive from the post itself.
  const description =
    post.metaDescription || post.excerpt || markdownToPlainText(post.content, 160);

  return {
    title: post.metaTitle ? { absolute: post.metaTitle } : post.title,
    description,
    alternates: post.canonicalUrl
      ? { canonical: post.canonicalUrl }
      : canonical(`/blog/${post.slug}`),
    openGraph: {
      type: "article",
      title: post.metaTitle || post.title,
      description,
      url: absoluteUrl(`/blog/${post.slug}`),
      images: post.coverImage ? [absoluteImageUrl(post.coverImage)] : ogImages(),
      ...(post.publishedAt ? { publishedTime: post.publishedAt.toISOString() } : {}),
      modifiedTime: post.updatedAt.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle || post.title,
      description,
      images: post.coverImage ? [absoluteImageUrl(post.coverImage)] : undefined,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const [related, html] = await Promise.all([
    getRelatedPosts(post.id, 3),
    Promise.resolve(renderMarkdown(post.content)),
  ]);

  const url = absoluteUrl(`/blog/${post.slug}`);
  const author = post.authorName || siteConfig.name;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    headline: post.title,
    description:
      post.metaDescription || post.excerpt || markdownToPlainText(post.content, 160),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: post.coverImage
      ? [absoluteImageUrl(post.coverImage)]
      : [absoluteImageUrl(siteConfig.ogImage)],
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: author, url: absoluteUrl("/") },
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
  };

  return (
    <article className="container max-w-3xl py-8 md:py-12">
      <JsonLd
        data={[
          articleJsonLd,
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />

      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/blog" className="hover:text-primary">Blog</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{post.title}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight md:text-4xl">{post.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              <time dateTime={post.publishedAt.toISOString()}>
                {formatPostDate(post.publishedAt)}
              </time>
            </span>
          )}
          <span>By {author}</span>
        </div>
      </header>

      {post.coverImage && (
        <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-lg bg-muted">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      {/*
        `html` comes from lib/markdown.ts, which escapes every `<` in the source
        before parsing and only emits tags it generates itself, so raw HTML in a
        post body can never reach the page.
      */}
      <div className="blog-content" dangerouslySetInnerHTML={{ __html: html }} />

      {related.length > 0 && (
        <section className="mt-16 border-t pt-10">
          <h2 className="mb-6 text-xl font-bold">Keep reading</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
