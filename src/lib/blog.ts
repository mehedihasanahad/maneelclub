import { cache } from "react";
import { db } from "@/lib/db";

/** A published post as the storefront needs it. */
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
}

/** Fields the storefront reads; keeps drafts and internal columns out. */
const postSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  coverImage: true,
  authorName: true,
  publishedAt: true,
  updatedAt: true,
  metaTitle: true,
  metaDescription: true,
  canonicalUrl: true,
} as const;

/**
 * Published posts, newest first.
 *
 * Errors are swallowed and an empty list returned so a database problem blanks
 * the blog list rather than taking the whole page down - the same approach the
 * product actions take.
 */
export const getPublishedPosts = cache(async (): Promise<BlogPost[]> => {
  try {
    return await db.post.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: postSelect,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
});

/** One published post by slug, or null when it is missing or still a draft. */
export const getPublishedPostBySlug = cache(
  async (slug: string): Promise<BlogPost | null> => {
    try {
      return await db.post.findFirst({
        where: { slug, status: "PUBLISHED", publishedAt: { not: null } },
        select: postSelect,
      });
    } catch (error) {
      console.error("Error fetching post:", error);
      return null;
    }
  }
);

/** Other recent posts, for the "keep reading" list under a post. */
export async function getRelatedPosts(excludeId: string, limit = 3): Promise<BlogPost[]> {
  const posts = await getPublishedPosts();
  return posts.filter((p) => p.id !== excludeId).slice(0, limit);
}
