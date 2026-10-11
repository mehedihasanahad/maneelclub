"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { PromotionInput } from "@/schemas/promotion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import {
  ALL_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  describePromotion,
  paymentRestrictionText,
} from "@/lib/pricing";
import {
  createPromotion,
  deletePromotion,
  getAdminPromotions,
  setPromotionActive,
  updatePromotion,
  type AdminPromotion,
} from "@/actions/admin/promotions";

type FormState = {
  name: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  freeShipping: boolean;
  isActive: boolean;
  startsAt: string; // datetime-local value in the admin's time zone
  endsAt: string;
  /** Ticked payment methods. All ticked = no restriction. */
  paymentMethods: string[];
};

const ONLINE_PAYMENT_METHODS = ALL_PAYMENT_METHODS.filter((m) => m !== "COD");

const EMPTY_FORM: FormState = {
  name: "",
  type: "PERCENT",
  value: "10",
  minOrderAmount: "",
  maxDiscount: "",
  freeShipping: false,
  isActive: true,
  startsAt: "",
  endsAt: "",
  paymentMethods: ALL_PAYMENT_METHODS,
};

/** ISO string -> value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function statusOf(p: AdminPromotion, now: Date): { label: string; tone: "live" | "off" | "scheduled" | "ended" } {
  if (!p.isActive) return { label: "Off", tone: "off" };
  if (p.startsAt && now < new Date(p.startsAt)) return { label: "Scheduled", tone: "scheduled" };
  if (p.endsAt && now > new Date(p.endsAt)) return { label: "Ended", tone: "ended" };
  return { label: "Live", tone: "live" };
}

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<AdminPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AdminPromotion | null>(null);
  const [now] = useState(() => new Date());

  async function load() {
    const res = await getAdminPromotions();
    if (res.success) {
      setOffers(res.data ?? []);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const res = await getAdminPromotions();
      if (res.success) setOffers(res.data ?? []);
      else setLoadError(res.error);
      setLoading(false);
    })();
  }, []);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function openEdit(p: AdminPromotion) {
    setForm({
      name: p.name,
      type: p.type,
      value: String(p.value),
      minOrderAmount: String(p.minOrderAmount),
      maxDiscount: p.maxDiscount != null ? String(p.maxDiscount) : "",
      freeShipping: p.freeShipping,
      isActive: p.isActive,
      startsAt: toLocalInput(p.startsAt),
      endsAt: toLocalInput(p.endsAt),
      paymentMethods: p.allowedPaymentMethods.length > 0 ? p.allowedPaymentMethods : ALL_PAYMENT_METHODS,
    });
    setEditingId(p.id);
  }

  async function save() {
    if (!editingId) return;
    if (form.paymentMethods.length === 0) {
      toast.error("Tick at least one payment method");
      return;
    }
    setSaving(true);
    const input = {
      name: form.name,
      type: form.type,
      value: form.value === "" ? 0 : Number(form.value),
      minOrderAmount: form.minOrderAmount === "" ? 0 : Number(form.minOrderAmount),
      maxDiscount: form.type === "PERCENT" && form.maxDiscount !== "" ? Number(form.maxDiscount) : null,
      freeShipping: form.freeShipping,
      isActive: form.isActive,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      // Every method ticked is stored as "no restriction".
      allowedPaymentMethods:
        form.paymentMethods.length === ALL_PAYMENT_METHODS.length
          ? []
          : (form.paymentMethods as PromotionInput["allowedPaymentMethods"]),
    };
    const res = editingId === "new" ? await createPromotion(input) : await updatePromotion(editingId, input);
    setSaving(false);
    if (res.success) {
      toast.success(editingId === "new" ? "Offer created" : "Offer updated");
      setEditingId(null);
      await load();
    } else {
      toast.error(res.error || "Could not save the offer");
    }
  }

  async function toggle(p: AdminPromotion, isActive: boolean) {
    setOffers((prev) => prev.map((o) => (o.id === p.id ? { ...o, isActive } : o)));
    const res = await setPromotionActive(p.id, isActive);
    if (!res.success) {
      setOffers((prev) => prev.map((o) => (o.id === p.id ? p : o)));
      toast.error(res.error || "Could not update the offer");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    const res = await deletePromotion(target.id);
    if (res.success) {
      setOffers((prev) => prev.filter((o) => o.id !== target.id));
      toast.success("Offer deleted");
    } else {
      toast.error(res.error || "Could not delete the offer");
    }
  }

  const previewValue = Number(form.value) || 0;
  const preview = describePromotion(
    {
      type: form.type,
      value: previewValue,
      maxDiscount: form.type === "PERCENT" && form.maxDiscount ? Number(form.maxDiscount) : null,
      freeShipping: form.freeShipping,
    },
    formatPrice
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automatic offers</h1>
          <p className="text-muted-foreground">
            Discounts that apply by themselves when the cart reaches an amount. No code needed.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New offer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How offers apply</CardTitle>
          <CardDescription>
            When a cart qualifies for several offers, the customer gets the one that saves them the
            most. Offers never combine with a discount code: the customer gets whichever saves more.
            The site-wide free delivery minimum in Settings still applies as before.
          </CardDescription>
        </CardHeader>
      </Card>

      {loadError ? (
        <p className="py-8 text-center text-sm text-destructive">Could not load offers: {loadError}</p>
      ) : offers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No offers yet. Create one, for example &quot;Spend BDT 3,000, get 10% off&quot;.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {offers.map((p) => {
            const status = statusOf(p, now);
            return (
              <Card key={p.id} className={cn(!p.isActive && "opacity-70")}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Gift className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Spend {formatPrice(p.minOrderAmount)}, get {describePromotion(p, formatPrice)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        status.tone === "live" && "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
                        status.tone === "scheduled" && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
                        (status.tone === "off" || status.tone === "ended") && "bg-muted text-muted-foreground"
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {p.startsAt || p.endsAt ? (
                      <p>
                        {p.startsAt ? `From ${new Date(p.startsAt).toLocaleString()}` : "From now"}
                        {p.endsAt ? ` until ${new Date(p.endsAt).toLocaleString()}` : ", no end date"}
                      </p>
                    ) : (
                      <p>No date limits</p>
                    )}
                    <p>
                      {p.allowedPaymentMethods.length > 0
                        ? `Only with ${paymentRestrictionText(p.allowedPaymentMethods)}`
                        : "All payment methods"}
                    </p>
                    <p>Used on {p.usedCount} order{p.usedCount === 1 ? "" : "s"}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t pt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={p.isActive} onCheckedChange={(v) => toggle(p, v)} />
                      {p.isActive ? "On" : "Off"}
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(p)}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={editingId != null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId === "new" ? "New offer" : "Edit offer"}</DialogTitle>
            <DialogDescription>Customers see the name at checkout, for example &quot;Eid offer&quot;.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="offer-name">Name</Label>
              <Input
                id="offer-name"
                value={form.name}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Eid offer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer-min">Minimum cart amount (BDT)</Label>
              <Input
                id="offer-min"
                type="number"
                min={0}
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                placeholder="e.g. 3000"
              />
              <p className="text-xs text-muted-foreground">Product total before delivery.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as FormState["type"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage off</SelectItem>
                    <SelectItem value="FIXED">Fixed amount off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-value">{form.type === "PERCENT" ? "Percent off" : "Amount off (BDT)"}</Label>
                <Input
                  id="offer-value"
                  type="number"
                  min={0}
                  max={form.type === "PERCENT" ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Use 0 for a free-delivery-only offer.</p>
              </div>
            </div>

            {form.type === "PERCENT" && (
              <div className="space-y-2">
                <Label htmlFor="offer-max">Maximum discount (BDT, optional)</Label>
                <Input
                  id="offer-max"
                  type="number"
                  min={1}
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  placeholder="No limit"
                />
              </div>
            )}

            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="block text-sm font-medium">Include free delivery</span>
                <span className="block text-xs text-muted-foreground">Delivery charge becomes 0 for this offer.</span>
              </span>
              <Switch checked={form.freeShipping} onCheckedChange={(v) => setForm({ ...form, freeShipping: v })} />
            </label>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <span className="block text-sm font-medium">Allowed payment methods</span>
                  <span className="block text-xs text-muted-foreground">
                    The offer only applies when the customer pays with a ticked method.
                  </span>
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ ...form, paymentMethods: ONLINE_PAYMENT_METHODS })}
                  >
                    Not with Cash on Delivery
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm({ ...form, paymentMethods: ALL_PAYMENT_METHODS })}
                  >
                    All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PAYMENT_METHODS.map((method) => (
                  <label key={method} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.paymentMethods.includes(method)}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          // Keep checkout order regardless of click order.
                          paymentMethods: ALL_PAYMENT_METHODS.filter((m) =>
                            m === method ? checked === true : form.paymentMethods.includes(m)
                          ),
                        })
                      }
                    />
                    {PAYMENT_METHOD_LABELS[method]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="offer-start">Starts (optional)</Label>
                <Input
                  id="offer-start"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-end">Ends (optional)</Label>
                <Input
                  id="offer-end"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm font-medium">Offer is on</span>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </label>

            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Customers will see: </span>
              <span className="font-medium">
                {preview
                  ? `Spend ${formatPrice(Number(form.minOrderAmount) || 0)}, get ${preview}${
                      form.paymentMethods.length > 0 && form.paymentMethods.length < ALL_PAYMENT_METHODS.length
                        ? ` (with ${paymentRestrictionText(form.paymentMethods)} payment)`
                        : ""
                    }`
                  : "Set a discount or turn on free delivery"}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId === "new" ? "Create offer" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              New orders will no longer get this offer. Past orders keep their discount and offer name.
              To pause it instead, switch it off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
