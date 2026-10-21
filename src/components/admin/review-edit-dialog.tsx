"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminProductsSearch } from "@/actions/admin/products";
import type { AdminReview } from "@/actions/admin/reviews";
import { REVIEW_SOURCES, SOURCE_META, type ReviewSource } from "@/lib/reviews-shared";

export interface ReviewEditValues {
  customerName: string;
  caption: string;
  /** 1-5 as the customer gave it, or null when they did not rate. */
  rating: number | null;
  source: ReviewSource;
  products: Array<{ id: string; title: string }>;
}

interface ReviewEditDialogProps {
  review: AdminReview | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ReviewEditValues) => void;
}

/** Edit a screenshot's details and the products it is tagged to. */
export function ReviewEditDialog({ review, saving, onOpenChange, onSave }: ReviewEditDialogProps) {
  return (
    <Dialog open={review != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit screenshot</DialogTitle>
          <DialogDescription>
            These details are not shown on the site. They describe the screenshot for screen readers
            and Google, and decide which product pages show it first.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so each screenshot starts from its own saved values. */}
        {review && (
          <ReviewEditForm
            key={review.id}
            review={review}
            saving={saving}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewEditForm({
  review,
  saving,
  onCancel,
  onSave,
}: {
  review: AdminReview;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: ReviewEditValues) => void;
}) {
  const [values, setValues] = useState<ReviewEditValues>({
    customerName: review.customerName,
    caption: review.caption,
    rating: review.rating,
    source: review.source,
    products: review.products,
  });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ query: string; items: Array<{ id: string; title: string }> }>({
    query: "",
    items: [],
  });

  const trimmed = query.trim();
  const searchable = trimmed.length >= 2;
  const searching = searchable && search.query !== trimmed;
  const results = searchable && search.query === trimmed ? search.items : [];

  // Debounced product search; results are stored with the query they answer.
  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await getAdminProductsSearch(trimmed);
      if (!cancelled) {
        setSearch({ query: trimmed, items: res.success ? res.data.map((p) => ({ id: p.id, title: p.title })) : [] });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, searchable]);

  const tagged = new Set(values.products.map((p) => p.id));

  return (
    <>
          <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
            <div className="relative mx-auto aspect-[9/16] w-40 overflow-hidden rounded-lg border bg-muted">
              <Image src={review.image} alt="" fill sizes="160px" className="object-cover" />
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-name">Customer name</Label>
                  <Input
                    id="review-name"
                    value={values.customerName}
                    maxLength={80}
                    onChange={(e) => setValues({ ...values, customerName: e.target.value })}
                    placeholder="e.g. Alif K."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Star rating</Label>
                  <Select
                    value={values.rating == null ? "none" : String(values.rating)}
                    onValueChange={(v) =>
                      setValues({ ...values, rating: v === "none" ? null : Number(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not rated</SelectItem>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {"★".repeat(n)}
                          {"☆".repeat(5 - n)} ({n})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only set this if the customer actually rated their order.
                    Rated screenshots appear as a star average on the product
                    page and in Google results.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select
                    value={values.source}
                    onValueChange={(v) => setValues({ ...values, source: v as ReviewSource })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SOURCE_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-caption">What the customer said</Label>
                <Textarea
                  id="review-caption"
                  value={values.caption}
                  maxLength={300}
                  rows={3}
                  onChange={(e) => setValues({ ...values, caption: e.target.value })}
                  placeholder="e.g. Quality is very good, exactly as expected."
                />
                <p className="text-xs text-muted-foreground">
                  A short English summary. Used as the image description, not displayed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-product-search">Tagged products</Label>
                <p className="text-xs text-muted-foreground">
                  Tagged screenshots appear first in that product&apos;s Reviews tab. Leave empty for a
                  general review.
                </p>
                {values.products.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {values.products.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs"
                      >
                        {p.title}
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-background"
                          onClick={() =>
                            setValues({ ...values, products: values.products.filter((x) => x.id !== p.id) })
                          }
                          aria-label={`Remove ${p.title}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="review-product-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products by name"
                    className="pl-9"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                {results.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto rounded-md border">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={tagged.has(p.id)}
                          onClick={() => {
                            setValues({ ...values, products: [...values.products, p] });
                            setQuery("");
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:text-muted-foreground"
                        >
                          {p.title}
                          {tagged.has(p.id) && " (tagged)"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSave(values)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
    </>
  );
}
