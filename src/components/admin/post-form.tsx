"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploader } from "./image-uploader";
import { SeoFields } from "./seo-fields";
import { slugify } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";

const formSchema = z.object({
  title: z.string().min(2, "Title is required").max(200),
  slug: z.string().min(2, "Slug is required").max(200),
  excerpt: z.string().max(300, "Keep the excerpt under 300 characters").optional(),
  content: z.string().min(1, "Content is required"),
  authorName: z.string().max(80).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  metaTitle: z.string().max(70, "Keep it under 70 characters").optional(),
  metaDescription: z.string().max(200, "Keep it under 200 characters").optional(),
  canonicalUrl: z.string().optional(),
});

export type PostFormValues = z.infer<typeof formSchema>;

export interface PostFormInitialValues extends Partial<PostFormValues> {
  coverImage?: string | null;
}

/**
 * Create/edit form for a blog post, shared by /admin/blog/new and
 * /admin/blog/[id].
 *
 * The slug is generated from the title only while creating. On an existing post
 * it is left alone, because changing it changes a live URL that Google and any
 * already-shared links point at.
 */
export function PostForm({
  mode,
  initial,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: PostFormInitialValues;
  onSubmit: (values: PostFormValues, coverImage: string | null) => Promise<boolean>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [coverImage, setCoverImage] = useState<string>(initial?.coverImage ?? "");
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(formSchema) as Resolver<PostFormValues>,
    defaultValues: {
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      excerpt: initial?.excerpt ?? "",
      content: initial?.content ?? "",
      authorName: initial?.authorName ?? "",
      status: initial?.status ?? "DRAFT",
      metaTitle: initial?.metaTitle ?? "",
      metaDescription: initial?.metaDescription ?? "",
      canonicalUrl: initial?.canonicalUrl ?? "",
    },
  });

  // useWatch rather than form.watch(): watch() cannot be memoized safely, and
  // the React Compiler flags it when the value feeds a computed render value
  // (the Markdown preview below).
  const title = useWatch({ control: form.control, name: "title" });
  const content = useWatch({ control: form.control, name: "content" });
  const excerpt = useWatch({ control: form.control, name: "excerpt" });
  const slug = useWatch({ control: form.control, name: "slug" });

  // Only auto-fill the slug for a new post; an existing URL must stay stable.
  useEffect(() => {
    if (mode === "create" && title) {
      form.setValue("slug", slugify(title));
    }
  }, [mode, title, form]);

  async function handleSubmit(values: PostFormValues) {
    setSaving(true);
    const ok = await onSubmit(values, coverImage.trim() || null);
    setSaving(false);
    if (ok) router.push("/admin/blog");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">
              {mode === "create" ? "New post" : "Edit post"}
            </h1>
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create post" : "Save changes"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="How to style a winter hoodie" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="how-to-style-a-winter-hoodie" {...field} />
                      </FormControl>
                      <FormDescription>
                        {mode === "create"
                          ? "Generated from the title. The post will live at /blog/your-slug."
                          : "Changing this changes a live URL - old links and Google results will 404."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="One or two sentences shown on the blog list."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional. Left empty, the start of the post is used.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Body</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPreview((v) => !v)}
                        >
                          {showPreview ? (
                            <>
                              <Pencil className="mr-2 h-4 w-4" />
                              Write
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Preview
                            </>
                          )}
                        </Button>
                      </div>
                      {showPreview ? (
                        <div
                          className="blog-content min-h-[18rem] rounded-md border p-4"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(content || "") }}
                        />
                      ) : (
                        <FormControl>
                          <Textarea
                            rows={18}
                            className="font-mono text-sm"
                            placeholder={"## A heading\n\nA paragraph with **bold** text and a [link](/shop).\n\n- First point\n- Second point"}
                            {...field}
                          />
                        </FormControl>
                      )}
                      <FormDescription>
                        Markdown is supported: <code>## heading</code>,{" "}
                        <code>**bold**</code>, <code>*italic*</code>,{" "}
                        <code>[text](/link)</code>, <code>- list</code>,{" "}
                        <code>![alt](image-url)</code>. HTML is not allowed and is
                        shown as plain text.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <SeoFields
              control={form.control}
              names={{
                metaTitle: "metaTitle",
                metaDescription: "metaDescription",
                canonicalUrl: "canonicalUrl",
              }}
              autoTitle={title || "Post title"}
              autoDescription={excerpt || "The first part of the post body."}
              canonicalExample={`https://maneelclub.com/blog/${slug || "post-slug"}`}
            />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="PUBLISHED">Published</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Drafts are not visible on the site or in the sitemap.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Author</FormLabel>
                      <FormControl>
                        <Input placeholder="Maneel Club" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormDescription>Defaults to the store name.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cover image</CardTitle>
                <CardDescription>
                  Shown on the blog list and when the post is shared.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploader
                  images={coverImage ? [coverImage] : []}
                  onChange={(urls) => setCoverImage(urls[0] ?? "")}
                  maxImages={1}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
