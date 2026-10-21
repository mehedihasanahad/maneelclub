"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";
import { postSchema, updatePostSchema, type PostInput, type UpdatePostInput } from "@/schemas/blog";

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

async function checkAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required");
  }
  return session.user;
}

function fail(error: unknown, fallback: string): { success: false; error: string } {
  console.error(fallback, error);
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return { success: false, error: issues[0]?.message ?? fallback };
  }
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

/** Blank optional field -> NULL, so the storefront falls back to the derived value. */
function nz(value: string | null | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

/** Refresh the blog list, the post itself and anything embedding recent posts. */
function revalidateBlog(slug?: string) {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
}

export type AdminPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  authorName: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAdminPosts(): Promise<Result<AdminPost[]>> {
  try {
    await checkAdmin();
    const posts = await db.post.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    return { success: true, data: posts };
  } catch (error) {
    return fail(error, "Failed to load posts");
  }
}

export async function getAdminPost(id: string): Promise<Result<AdminPost>> {
  try {
    await checkAdmin();
    const post = await db.post.findUnique({ where: { id } });
    if (!post) return { success: false, error: "Post not found" };
    return { success: true, data: post };
  } catch (error) {
    return fail(error, "Failed to load post");
  }
}

export async function createPost(input: PostInput): Promise<Result<{ id: string }>> {
  try {
    await checkAdmin();
    const data = postSchema.parse(input);

    // Normalise the slug the same way categories do, falling back to the title.
    const slug = slugify(data.slug) || slugify(data.title);
    if (!slug) {
      return { success: false, error: "Could not build a valid slug from the title" };
    }

    const existing = await db.post.findUnique({ where: { slug } });
    if (existing) {
      return { success: false, error: "A post with this slug already exists" };
    }

    const post = await db.post.create({
      data: {
        title: data.title,
        slug,
        excerpt: nz(data.excerpt),
        content: data.content,
        coverImage: nz(data.coverImage),
        authorName: nz(data.authorName),
        status: data.status,
        // Stamped on first publish so ordering and datePublished are stable.
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        metaTitle: nz(data.metaTitle),
        metaDescription: nz(data.metaDescription),
        canonicalUrl: nz(data.canonicalUrl),
      },
    });

    revalidateBlog(post.slug);
    return { success: true, data: { id: post.id } };
  } catch (error) {
    return fail(error, "Failed to create post");
  }
}

export async function updatePost(id: string, input: UpdatePostInput): Promise<Result> {
  try {
    await checkAdmin();
    const data = updatePostSchema.parse(input);

    const post = await db.post.findUnique({ where: { id } });
    if (!post) return { success: false, error: "Post not found" };

    let slug = post.slug;
    if (data.slug !== undefined) {
      slug = slugify(data.slug) || slugify(data.title ?? post.title);
      if (!slug) return { success: false, error: "Could not build a valid slug" };
      if (slug !== post.slug) {
        const clash = await db.post.findUnique({ where: { slug } });
        if (clash) return { success: false, error: "A post with this slug already exists" };
      }
    }

    // publishedAt is set once, on the first publish, and kept thereafter so
    // re-publishing a post does not reset its date and reorder the blog.
    const publishedAt =
      data.status === "PUBLISHED" && !post.publishedAt ? new Date() : post.publishedAt;

    await db.post.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug }),
        ...(data.excerpt !== undefined && { excerpt: nz(data.excerpt) }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.coverImage !== undefined && { coverImage: nz(data.coverImage) }),
        ...(data.authorName !== undefined && { authorName: nz(data.authorName) }),
        ...(data.status !== undefined && { status: data.status, publishedAt }),
        ...(data.metaTitle !== undefined && { metaTitle: nz(data.metaTitle) }),
        ...(data.metaDescription !== undefined && { metaDescription: nz(data.metaDescription) }),
        ...(data.canonicalUrl !== undefined && { canonicalUrl: nz(data.canonicalUrl) }),
      },
    });

    // Revalidate both slugs when it changed, so the old URL stops serving.
    revalidateBlog(post.slug);
    if (slug !== post.slug) revalidateBlog(slug);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to update post");
  }
}

/** Publish / unpublish from the list, without opening the editor. */
export async function togglePostStatus(id: string): Promise<Result> {
  try {
    await checkAdmin();
    const post = await db.post.findUnique({ where: { id } });
    if (!post) return { success: false, error: "Post not found" };

    const status = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await db.post.update({
      where: { id },
      data: {
        status,
        publishedAt: status === "PUBLISHED" && !post.publishedAt ? new Date() : post.publishedAt,
      },
    });

    revalidateBlog(post.slug);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to update post status");
  }
}

export async function deletePost(id: string): Promise<Result> {
  try {
    await checkAdmin();
    const post = await db.post.findUnique({ where: { id } });
    if (!post) return { success: false, error: "Post not found" };

    await db.post.delete({ where: { id } });
    revalidateBlog(post.slug);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to delete post");
  }
}
