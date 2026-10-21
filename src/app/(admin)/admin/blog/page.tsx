"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  deletePost,
  getAdminPosts,
  togglePostStatus,
  type AdminPost,
} from "@/actions/admin/blog";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /**
   * Fetch and store the list.
   *
   * `loading` starts true and is only cleared after the request resolves, so
   * the mount effect never sets state synchronously.
   */
  async function load() {
    const result = await getAdminPosts();
    if (result.success) {
      setPosts(result.data ?? []);
    } else {
      toast.error(result.error || "Failed to load posts");
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const result = await getAdminPosts();
      if (!active) return;
      if (result.success) {
        setPosts(result.data ?? []);
      } else {
        toast.error(result.error || "Failed to load posts");
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function onToggle(post: AdminPost) {
    setBusyId(post.id);
    const result = await togglePostStatus(post.id);
    setBusyId(null);
    if (result.success) {
      toast.success(post.status === "PUBLISHED" ? "Moved to draft" : "Published");
      load();
    } else {
      toast.error(result.error || "Failed to update");
    }
  }

  async function onDelete() {
    if (!deleteId) return;
    setBusyId(deleteId);
    const result = await deletePost(deleteId);
    setBusyId(null);
    setDeleteId(null);
    if (result.success) {
      toast.success("Post deleted");
      load();
    } else {
      toast.error(result.error || "Failed to delete");
    }
  }

  const term = query.trim().toLowerCase();
  const filtered = term
    ? posts.filter(
        (p) => p.title.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term)
      )
    : posts;

  const published = posts.filter((p) => p.status === "PUBLISHED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted-foreground">
            {posts.length} {posts.length === 1 ? "post" : "posts"} &middot; {published} published
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/blog" target="_blank">View blog</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/blog/new">
              <Plus className="mr-2 h-4 w-4" />
              New post
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>
            Drafts are only visible here. Publishing a post adds it to the blog and
            the sitemap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by title or slug..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading posts...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {posts.length === 0 ? (
                <>
                  <p>No posts yet.</p>
                  <Button className="mt-4" asChild>
                    <Link href="/admin/blog/new">Write the first post</Link>
                  </Button>
                </>
              ) : (
                <p>No posts match &quot;{query}&quot;.</p>
              )}
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {filtered.map((post) => (
                <div
                  key={post.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{post.title}</p>
                      <Badge variant={post.status === "PUBLISHED" ? "default" : "secondary"}>
                        {post.status === "PUBLISHED" ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      /blog/{post.slug}
                      {post.publishedAt
                        ? ` · ${new Date(post.publishedAt).toLocaleDateString("en-GB")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggle(post)}
                      disabled={busyId === post.id}
                      title={post.status === "PUBLISHED" ? "Move to draft" : "Publish"}
                    >
                      {post.status === "PUBLISHED" ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/blog/${post.id}`} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(post.id)}
                      disabled={busyId === post.id}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. If the post is published, its URL will start
              returning 404 — move it to draft instead if you only want to hide it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
