"use client";

import { use, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PostForm, type PostFormValues, type PostFormInitialValues } from "@/components/admin";
import { getAdminPost, updatePost } from "@/actions/admin/blog";

export default function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initial, setInitial] = useState<PostFormInitialValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const result = await getAdminPost(id);
      if (!active) return;

      if (result.success && result.data) {
        const post = result.data;
        setInitial({
          title: post.title,
          slug: post.slug,
          // Empty strings rather than null so the inputs stay controlled.
          excerpt: post.excerpt ?? "",
          content: post.content,
          authorName: post.authorName ?? "",
          status: post.status,
          metaTitle: post.metaTitle ?? "",
          metaDescription: post.metaDescription ?? "",
          canonicalUrl: post.canonicalUrl ?? "",
          coverImage: post.coverImage,
        });
      } else {
        setError(result.success ? "Post not found" : result.error);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  async function onSubmit(values: PostFormValues, coverImage: string | null) {
    const result = await updatePost(id, { ...values, coverImage });

    if (result.success) {
      toast.success("Post updated");
      return true;
    }

    toast.error(result.error || "Failed to update post");
    return false;
  }

  if (error) {
    return <p className="py-12 text-center text-muted-foreground">{error}</p>;
  }

  if (!initial) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading post...
      </div>
    );
  }

  // Keyed so the form state is rebuilt if the loaded post ever changes.
  return <PostForm key={id} mode="edit" initial={initial} onSubmit={onSubmit} />;
}
