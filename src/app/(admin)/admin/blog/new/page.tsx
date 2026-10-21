"use client";

import { toast } from "sonner";
import { PostForm, type PostFormValues } from "@/components/admin";
import { createPost } from "@/actions/admin/blog";

export default function NewPostPage() {
  async function onSubmit(values: PostFormValues, coverImage: string | null) {
    const result = await createPost({ ...values, coverImage });

    if (result.success) {
      toast.success(
        values.status === "PUBLISHED" ? "Post published" : "Draft saved"
      );
      return true;
    }

    toast.error(result.error || "Failed to create post");
    return false;
  }

  return <PostForm mode="create" onSubmit={onSubmit} />;
}
