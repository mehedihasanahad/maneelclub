"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { promotionSchema, type PromotionInput } from "@/schemas/promotion";
import { ALL_PAYMENT_METHODS } from "@/lib/pricing";

async function checkAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required");
  }
  return session.user;
}

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

function fail(error: unknown, fallback: string): { success: false; error: string } {
  console.error(fallback, error);
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return { success: false, error: issues[0]?.message ?? fallback };
  }
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

function revalidateOffers() {
  revalidatePath("/admin/offers");
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export type AdminPromotion = {
  id: string;
  name: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  freeShipping: boolean;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Empty = every payment method. */
  allowedPaymentMethods: string[];
  usedCount: number;
};

export async function getAdminPromotions(): Promise<Result<AdminPromotion[]>> {
  try {
    await checkAdmin();
    const rows = await db.promotion.findMany({ orderBy: [{ isActive: "desc" }, { minOrderAmount: "asc" }] });
    return {
      success: true,
      data: rows.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        value: Number(p.value),
        minOrderAmount: Number(p.minOrderAmount),
        maxDiscount: p.maxDiscount != null ? Number(p.maxDiscount) : null,
        freeShipping: p.freeShipping,
        isActive: p.isActive,
        startsAt: p.startsAt?.toISOString() ?? null,
        endsAt: p.endsAt?.toISOString() ?? null,
        allowedPaymentMethods: p.allowedPaymentMethods,
        usedCount: p.usedCount,
      })),
    };
  } catch (error) {
    return fail(error, "Failed to load offers");
  }
}

function toData(input: PromotionInput) {
  const d = promotionSchema.parse(input);
  return {
    ...d,
    // A cap only makes sense for percentage offers.
    maxDiscount: d.type === "PERCENT" ? (d.maxDiscount ?? null) : null,
    // Every method ticked means "no restriction": store it as the empty list.
    allowedPaymentMethods: d.allowedPaymentMethods.length >= ALL_PAYMENT_METHODS.length ? [] : d.allowedPaymentMethods,
  };
}

export async function createPromotion(input: PromotionInput): Promise<Result> {
  try {
    await checkAdmin();
    await db.promotion.create({ data: toData(input) });
    revalidateOffers();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to create offer");
  }
}

export async function updatePromotion(id: string, input: PromotionInput): Promise<Result> {
  try {
    await checkAdmin();
    await db.promotion.update({ where: { id }, data: toData(input) });
    revalidateOffers();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to update offer");
  }
}

export async function setPromotionActive(id: string, isActive: boolean): Promise<Result> {
  try {
    await checkAdmin();
    await db.promotion.update({ where: { id }, data: { isActive } });
    revalidateOffers();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to update offer");
  }
}

/** Deletes the offer. Past orders keep their recorded offer name and discount. */
export async function deletePromotion(id: string): Promise<Result> {
  try {
    await checkAdmin();
    await db.promotion.delete({ where: { id } });
    revalidateOffers();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to delete offer");
  }
}
