import { cache } from "react";
import { db } from "@/lib/db";
import type { Promotion } from "@/lib/pricing";

export type { Promotion };

type PromotionRow = {
  id: string;
  name: string;
  type: "PERCENT" | "FIXED";
  value: unknown;
  minOrderAmount: unknown;
  maxDiscount: unknown;
  freeShipping: boolean;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  allowedPaymentMethods: string[];
};

export function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    value: Number(row.value),
    minOrderAmount: Number(row.minOrderAmount),
    maxDiscount: row.maxDiscount != null ? Number(row.maxDiscount) : null,
    freeShipping: row.freeShipping,
    isActive: row.isActive,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allowedPaymentMethods: row.allowedPaymentMethods ?? [],
  };
}

/**
 * Active automatic offers (date windows are checked at pricing time). Cached per request.
 *
 * Safety: if the Promotion table does not exist yet (code deployed before the migration) or the
 * query fails, this logs and returns [], so checkout prices exactly as it did before offers existed.
 */
export const getActivePromotions = cache(async (): Promise<Promotion[]> => {
  try {
    const rows = await db.promotion.findMany({
      where: { isActive: true },
      orderBy: { minOrderAmount: "asc" },
    });
    return rows.map(toPromotion);
  } catch (error) {
    console.error("Error fetching promotions (checkout continues without offers):", error);
    return [];
  }
});

/** The offer recorded on an order, if any. Returns null when none or when the table is missing. */
export async function getOrderPromotion(
  orderId: string
): Promise<{ name: string; discountAmount: number; freeShipping: boolean } | null> {
  try {
    const row = await db.orderPromotion.findUnique({
      where: { orderId },
      select: { name: true, discountAmount: true, freeShipping: true },
    });
    return row ? { ...row, discountAmount: Number(row.discountAmount) } : null;
  } catch {
    return null;
  }
}
