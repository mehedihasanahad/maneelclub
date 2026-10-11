/**
 * Order pricing shared by the checkout display (client) and createOrder (server), so the price
 * shown is always the price charged. Pure: no database access.
 *
 * Rules:
 *  - Delivery is the zone rate, free at or above the site-wide free-shipping minimum (0 = off).
 *  - Automatic offers ("spend X, get Y") apply without a code. When several qualify, the one that
 *    saves the customer the most wins (discount plus any delivery it makes free).
 *  - A customer's coupon code and an automatic offer never stack: the bigger saving wins,
 *    and the code wins a tie.
 *  - An offer can be limited to certain payment methods (e.g. not Cash on Delivery). It only
 *    applies when the chosen method is allowed. With no method chosen yet (cart) it is previewed.
 */

/** Payment methods, in checkout order. Labels are customer-facing. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
};
export const ALL_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS);

export type DiscountType = "PERCENT" | "FIXED";

/** An automatic offer, with Decimal fields already converted to numbers. */
export interface Promotion {
  id: string;
  /** Shown to customers, e.g. "Eid offer". */
  name: string;
  type: DiscountType;
  value: number;
  minOrderAmount: number;
  /** Cap for percentage offers; null means no cap. */
  maxDiscount: number | null;
  freeShipping: boolean;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Payment methods the offer is valid for. Empty means every method. */
  allowedPaymentMethods: string[];
}

/** A coupon code that the server has already validated for this subtotal. */
export interface AppliedCoupon {
  couponId: string;
  code: string;
  discount: number;
}

export type AppliedDiscount =
  | { kind: "coupon"; couponId: string; code: string }
  | { kind: "promotion"; promotionId: string; name: string; freeShipping: boolean };

export interface OrderPricing {
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  applied: AppliedDiscount | null;
}

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export function isPromotionLive(p: Promotion, now: Date): boolean {
  return (
    p.isActive &&
    (!p.startsAt || now >= new Date(p.startsAt)) &&
    (!p.endsAt || now <= new Date(p.endsAt))
  );
}

/**
 * Whether an offer may be used with the chosen payment method. An offer with no restriction is
 * valid for every method; with no method chosen yet (null/undefined) the offer is previewed.
 */
export function isPromotionAllowedForPayment(p: Promotion, paymentMethod: string | null | undefined): boolean {
  const allowed = p.allowedPaymentMethods ?? [];
  if (allowed.length === 0 || paymentMethod == null) return true;
  return allowed.includes(paymentMethod);
}

/** Money off the subtotal for an offer (ignores its minimum). */
export function promotionDiscount(p: Promotion, subtotal: number): number {
  if (p.type === "PERCENT") {
    const raw = roundMoney((subtotal * p.value) / 100);
    return p.maxDiscount != null && p.maxDiscount > 0 ? Math.min(raw, p.maxDiscount) : raw;
  }
  return Math.min(p.value, subtotal);
}

export interface PricingInput {
  subtotal: number;
  zoneRate: number;
  freeShippingMinimum: number;
  coupon: AppliedCoupon | null;
  promotions: Promotion[];
  now: Date;
  /** Chosen payment method (e.g. "COD"). Omit when not chosen yet, e.g. on the cart page. */
  paymentMethod?: string | null;
}

export function computeOrderPricing(input: PricingInput): OrderPricing {
  const { subtotal, zoneRate, freeShippingMinimum, coupon, promotions, now, paymentMethod } = input;
  const baseShipping = freeShippingMinimum > 0 && subtotal >= freeShippingMinimum ? 0 : zoneRate;

  // Best qualifying automatic offer, by total saving.
  let bestPromotion: { promotion: Promotion; discount: number; saving: number } | null = null;
  for (const promotion of promotions) {
    if (!isPromotionLive(promotion, now) || subtotal < promotion.minOrderAmount) continue;
    if (!isPromotionAllowedForPayment(promotion, paymentMethod)) continue;
    const discount = promotionDiscount(promotion, subtotal);
    const saving = discount + (promotion.freeShipping ? baseShipping : 0);
    if (saving > 0 && (!bestPromotion || saving > bestPromotion.saving)) {
      bestPromotion = { promotion, discount, saving };
    }
  }

  const couponSaving = coupon && coupon.discount > 0 ? coupon.discount : 0;
  const useCoupon = coupon != null && couponSaving > 0 && couponSaving >= (bestPromotion?.saving ?? 0);

  let discount = 0;
  let shippingCost = baseShipping;
  let applied: AppliedDiscount | null = null;

  if (useCoupon) {
    discount = coupon.discount;
    applied = { kind: "coupon", couponId: coupon.couponId, code: coupon.code };
  } else if (bestPromotion) {
    discount = bestPromotion.discount;
    if (bestPromotion.promotion.freeShipping) shippingCost = 0;
    applied = {
      kind: "promotion",
      promotionId: bestPromotion.promotion.id,
      name: bestPromotion.promotion.name,
      freeShipping: bestPromotion.promotion.freeShipping,
    };
  }

  return {
    subtotal,
    discount,
    shippingCost,
    total: Math.max(0, subtotal - discount + shippingCost),
    applied,
  };
}

/**
 * At checkout: an offer the customer would get with a different payment method, e.g. they chose
 * Cash on Delivery but the offer needs online payment. Returns the offer, the methods that unlock
 * it and how much more they would save; null if their current choice is already the best deal.
 */
export function findOfferBlockedByPayment(
  input: PricingInput
): { promotion: Promotion; paymentMethods: string[]; extraSaving: number } | null {
  if (input.paymentMethod == null) return null;
  const current = computeOrderPricing(input);

  let best: { promotion: Promotion; paymentMethods: string[]; extraSaving: number } | null = null;
  for (const method of ALL_PAYMENT_METHODS) {
    if (method === input.paymentMethod) continue;
    const alternative = computeOrderPricing({ ...input, paymentMethod: method });
    if (alternative.applied?.kind !== "promotion") continue;
    const promotionId = alternative.applied.promotionId;
    const promotion = input.promotions.find((p) => p.id === promotionId);
    if (!promotion || isPromotionAllowedForPayment(promotion, input.paymentMethod)) continue;
    const extraSaving = roundMoney(current.total - alternative.total);
    if (extraSaving <= 0) continue;
    if (!best || extraSaving > best.extraSaving) {
      best = { promotion, paymentMethods: promotion.allowedPaymentMethods, extraSaving };
    }
  }
  return best;
}

/** "bKash, Nagad or Rocket" for an offer's allowed methods; "" when it has no restriction. */
export function paymentRestrictionText(methods: string[]): string {
  const labels = methods.map((m) => PAYMENT_METHOD_LABELS[m] ?? m);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/** The nearest live offer the cart has not reached yet, for "add ৳X more" nudges. */
export function findNextPromotion(
  promotions: Promotion[],
  subtotal: number,
  now: Date
): { promotion: Promotion; amountNeeded: number } | null {
  const upcoming = promotions
    .filter((p) => isPromotionLive(p, now) && p.minOrderAmount > subtotal)
    .sort((a, b) => a.minOrderAmount - b.minOrderAmount);
  const next = upcoming[0];
  return next ? { promotion: next, amountNeeded: roundMoney(next.minOrderAmount - subtotal) } : null;
}

/**
 * Short customer-facing description, e.g. "10% off (up to BDT 500) + free delivery".
 * `money` is the store's price formatter so amounts match the rest of the site.
 */
export function describePromotion(
  p: Pick<Promotion, "type" | "value" | "maxDiscount" | "freeShipping">,
  money: (amount: number) => string
): string {
  const off =
    p.value > 0
      ? p.type === "PERCENT"
        ? `${p.value}% off${p.maxDiscount ? ` (up to ${money(p.maxDiscount)})` : ""}`
        : `${money(p.value)} off`
      : "";
  if (off && p.freeShipping) return `${off} + free delivery`;
  return off || (p.freeShipping ? "Free delivery" : "");
}
