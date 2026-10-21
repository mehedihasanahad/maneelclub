"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Save,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import {
  createReviews,
  deleteReview,
  getAdminReviews,
  reorderReviews,
  updateReview,
  type AdminReview,
} from "@/actions/admin/reviews";
import { getSettings, updateSettings } from "@/actions/admin/settings";
import {
  SOCIAL_PROOF_DEFAULTS,
  SOURCE_META,
  buildSocialProofSettings,
} from "@/lib/reviews-shared";
import { Textarea } from "@/components/ui/textarea";
import { ReviewEditDialog, type ReviewEditValues } from "@/components/admin/review-edit-dialog";

type SocialProofKey = keyof typeof SOCIAL_PROOF_DEFAULTS;
const SOCIAL_PROOF_KEYS = Object.keys(SOCIAL_PROOF_DEFAULTS) as SocialProofKey[];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Read an image file's pixel size in the browser before uploading it. */
async function measureImage(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [display, setDisplay] = useState<Record<SocialProofKey, string>>({ ...SOCIAL_PROOF_DEFAULTS });
  const [displayDirty, setDisplayDirty] = useState(false);
  const [displaySaving, setDisplaySaving] = useState(false);

  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<AdminReview | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<AdminReview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadReviews() {
    const res = await getAdminReviews();
    if (res.success) {
      setReviews(res.data ?? []);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
  }

  useEffect(() => {
    (async () => {
      const [, settingsRes] = await Promise.all([loadReviews(), getSettings()]);
      if (settingsRes.success && settingsRes.data) {
        const next = { ...SOCIAL_PROOF_DEFAULTS } as Record<SocialProofKey, string>;
        for (const key of SOCIAL_PROOF_KEYS) next[key] = settingsRes.data[key] ?? SOCIAL_PROOF_DEFAULTS[key];
        setDisplay(next);
      }
      setLoading(false);
    })();
  }, []);

  // ---------- Display settings ----------

  function setDisplayValue(key: SocialProofKey, value: string) {
    setDisplay((prev) => ({ ...prev, [key]: value }));
    setDisplayDirty(true);
  }

  async function saveDisplay() {
    setDisplaySaving(true);
    const res = await updateSettings(display);
    setDisplaySaving(false);
    if (res.success) {
      setDisplayDirty(false);
      toast.success("Display settings saved");
    } else {
      toast.error(res.error || "Failed to save display settings");
    }
  }

  // ---------- Upload ----------

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    const skipped = files.length - list.length;
    if (list.length === 0) {
      toast.error("Choose JPG, PNG or WebP screenshots.");
      return;
    }

    setUpload({ done: 0, total: list.length });
    const saved: Array<{ image: string; width: number; height: number }> = [];
    const failed: string[] = [];

    for (const file of list) {
      try {
        const size = await measureImage(file);
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        saved.push({ image: data.url, ...size });
      } catch {
        failed.push(file.name);
      }
      setUpload((u) => (u ? { ...u, done: u.done + 1 } : u));
    }

    if (saved.length > 0) {
      const res = await createReviews(saved);
      if (res.success) {
        toast.success(`${saved.length} screenshot${saved.length === 1 ? "" : "s"} added`);
        await loadReviews();
      } else {
        toast.error(res.error || "Uploaded, but saving failed");
      }
    }
    if (failed.length > 0) toast.error(`Could not upload: ${failed.join(", ")}`);
    if (skipped > 0) toast.warning(`${skipped} file${skipped === 1 ? " was" : "s were"} not an image and skipped`);

    setUpload(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  // ---------- Per-review actions ----------

  async function patch(review: AdminReview, change: Partial<Pick<AdminReview, "isActive" | "isFeatured">>) {
    setBusyId(review.id);
    setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, ...change } : r)));
    const res = await updateReview(review.id, change);
    setBusyId(null);
    if (!res.success) {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? review : r)));
      toast.error(res.error || "Failed to update");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= reviews.length) return;
    const previous = reviews;
    const next = [...reviews];
    [next[index], next[target]] = [next[target], next[index]];
    setReviews(next);
    const res = await reorderReviews(next.map((r) => r.id));
    if (!res.success) {
      setReviews(previous);
      toast.error(res.error || "Failed to reorder");
    }
  }

  async function saveEdit(values: ReviewEditValues) {
    if (!editing) return;
    setEditSaving(true);
    const res = await updateReview(editing.id, {
      customerName: values.customerName,
      caption: values.caption,
      rating: values.rating,
      source: values.source,
      productIds: values.products.map((p) => p.id),
    });
    setEditSaving(false);
    if (res.success) {
      setReviews((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, customerName: values.customerName.trim(), caption: values.caption.trim(), rating: values.rating, source: values.source, products: values.products }
            : r
        )
      );
      setEditing(null);
      toast.success("Screenshot updated");
    } else {
      toast.error(res.error || "Failed to update");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    const res = await deleteReview(target.id);
    if (res.success) {
      setReviews((prev) => prev.filter((r) => r.id !== target.id));
      toast.success("Screenshot removed");
    } else {
      toast.error(res.error || "Failed to delete");
    }
  }

  // ---------- Render ----------

  // Same logic the storefront uses, so the preview matches the home page exactly.
  const preview = buildSocialProofSettings(display);

  const activeCount = reviews.filter((r) => r.isActive).length;
  const featuredCount = reviews.filter((r) => r.isActive && r.isFeatured).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">
            Customer screenshots on the home page, the reviews page and product pages.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/reviews" target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            View reviews page
          </Link>
        </Button>
      </div>

      {/* Display settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display settings</CardTitle>
          <CardDescription>
            The numbers shown next to the screenshots, and where the reviews appear.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reviewsCustomerCount">Customer count</Label>
              <Input
                id="reviewsCustomerCount"
                value={display.reviewsCustomerCount}
                onChange={(e) => setDisplayValue("reviewsCustomerCount", e.target.value)}
                placeholder="10,000+"
              />
              <p className="text-xs text-muted-foreground">
                Home heading, product page trust line and reviews page.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviewsOrdersDelivered">Orders delivered</Label>
              <Input
                id="reviewsOrdersDelivered"
                value={display.reviewsOrdersDelivered}
                onChange={(e) => setDisplayValue("reviewsOrdersDelivered", e.target.value)}
                placeholder="8,800+"
              />
              <p className="text-xs text-muted-foreground">Shown under the home page heading.</p>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Home page text</p>
              <p className="text-xs text-muted-foreground">
                Type <code className="rounded bg-muted px-1">{"{customers}"}</code> or{" "}
                <code className="rounded bg-muted px-1">{"{orders}"}</code> to insert the numbers above.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviewsHomeHeading">Heading</Label>
              <Input
                id="reviewsHomeHeading"
                value={display.reviewsHomeHeading}
                maxLength={120}
                onChange={(e) => setDisplayValue("reviewsHomeHeading", e.target.value)}
                placeholder={SOCIAL_PROOF_DEFAULTS.reviewsHomeHeading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviewsHomeDescription">Description</Label>
              <Textarea
                id="reviewsHomeDescription"
                value={display.reviewsHomeDescription}
                maxLength={400}
                rows={3}
                onChange={(e) => setDisplayValue("reviewsHomeDescription", e.target.value)}
                placeholder={SOCIAL_PROOF_DEFAULTS.reviewsHomeDescription}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to show the heading only. An empty heading goes back to the default.
              </p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="mb-1 text-xs text-muted-foreground">Preview</p>
              <p className="font-semibold">{preview.homeHeading}</p>
              {preview.homeDescription && (
                <p className="mt-1 text-sm text-muted-foreground">{preview.homeDescription}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["reviewsHomeEnabled", "Home page section"],
                ["reviewsProductTabEnabled", "Product page Reviews tab"],
                ["reviewsTrustLineEnabled", "Trust line under Buy Now"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                htmlFor={key}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span className="text-sm font-medium">{label}</span>
                <Switch
                  id={key}
                  checked={display[key] !== "false"}
                  onCheckedChange={(checked) => setDisplayValue(key, checked ? "true" : "false")}
                />
              </label>
            ))}
          </div>

          <Button onClick={saveDisplay} disabled={!displayDirty || displaySaving}>
            {displaySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save display settings
          </Button>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Add screenshots</CardTitle>
          <CardDescription>
            Choose several at once. New screenshots are shown on the site straight away, at the end
            of the list. Star the best ones to show them first on the home page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Blur or crop customers&apos; names, profile photos and phone numbers before uploading,
              unless they agreed to be shown.
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={upload !== null}>
            {upload ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading {Math.min(upload.done + 1, upload.total)} of {upload.total}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Choose screenshots
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Screenshot grid */}
      <Card>
        <CardHeader>
          <CardTitle>Screenshots</CardTitle>
          <CardDescription>
            {reviews.length} total, {activeCount} shown on the site, {featuredCount} starred. The order
            here is the order on the site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="py-8 text-center text-sm text-destructive">
              Could not load screenshots: {loadError}
            </p>
          ) : reviews.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No screenshots yet. Use &quot;Choose screenshots&quot; above to add the first ones.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {reviews.map((review, index) => (
                <li key={review.id} className={cn("space-y-2", !review.isActive && "opacity-60")}>
                  <div className="relative aspect-[9/16] overflow-hidden rounded-lg border bg-muted">
                    <Image
                      src={review.image}
                      alt={review.caption || "Customer screenshot"}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium tabular-nums">
                      {index + 1}
                    </span>
                    {review.isFeatured && (
                      <span className="absolute right-2 top-2 rounded-full bg-amber-400 p-1 text-amber-950">
                        <Star className="h-3 w-3 fill-current" />
                      </span>
                    )}
                    {!review.isActive && (
                      <span className="absolute inset-x-2 bottom-2 rounded bg-background/90 px-2 py-1 text-center text-xs">
                        Hidden from site
                      </span>
                    )}
                  </div>

                  <div className="min-h-[2.5rem] text-xs">
                    <p className="truncate font-medium">{review.customerName || "No name"}</p>
                    <p className="truncate text-muted-foreground">
                      {SOURCE_META[review.source].label}
                      {review.products.length > 0 &&
                        `, ${review.products.length} product${review.products.length === 1 ? "" : "s"}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => patch(review, { isActive: !review.isActive })}
                      disabled={busyId === review.id}
                      aria-label={review.isActive ? "Hide from site" : "Show on site"}
                      title={review.isActive ? "Hide from site" : "Show on site"}
                    >
                      {review.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className={cn("h-8 w-8", review.isFeatured && "text-amber-600")}
                      onClick={() => patch(review, { isFeatured: !review.isFeatured })}
                      disabled={busyId === review.id}
                      aria-label={review.isFeatured ? "Remove star" : "Star: show first on home page"}
                      title={review.isFeatured ? "Remove star" : "Star: show first on home page"}
                    >
                      <Star className={cn("h-4 w-4", review.isFeatured && "fill-current")} />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Move earlier"
                      title="Move earlier"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => move(index, 1)}
                      disabled={index === reviews.length - 1}
                      aria-label="Move later"
                      title="Move later"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => setEditing(review)}
                      aria-label="Edit details"
                      title="Edit details"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(review)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ReviewEditDialog
        review={editing}
        saving={editSaving}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={saveEdit}
      />

      <AlertDialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this screenshot?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the home page, the reviews page and product pages. To take it
              off the site temporarily instead, use the eye button to hide it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
