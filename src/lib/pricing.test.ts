import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeOrderPricing,
  describePromotion,
  findNextPromotion,
  findOfferBlockedByPayment,
  paymentRestrictionText,
  promotionDiscount,
  type Promotion,
} from "./pricing";

const NOW = new Date("2026-10-01T12:00:00Z");

function promo(id: string, overrides: Partial<Promotion> = {}): Promotion {
  return {
    id,
    name: `Offer ${id}`,
    type: "PERCENT",
    value: 10,
    minOrderAmount: 0,
    maxDiscount: null,
    freeShipping: false,
    isActive: true,
    startsAt: null,
    endsAt: null,
    allowedPaymentMethods: [],
    ...overrides,
  };
}

const base = { zoneRate: 130, freeShippingMinimum: 2500, coupon: null, promotions: [] as Promotion[], now: NOW };

describe("computeOrderPricing without offers (today's behaviour)", () => {
  it("charges the zone rate below the free-shipping minimum", () => {
    assert.deepEqual(computeOrderPricing({ ...base, subtotal: 1000 }), {
      subtotal: 1000,
      discount: 0,
      shippingCost: 130,
      total: 1130,
      applied: null,
    });
  });

  it("gives free shipping at the minimum", () => {
    assert.equal(computeOrderPricing({ ...base, subtotal: 2500 }).shippingCost, 0);
  });

  it("disables free shipping when the minimum is 0", () => {
    assert.equal(computeOrderPricing({ ...base, freeShippingMinimum: 0, subtotal: 9000 }).shippingCost, 130);
  });

  it("applies a validated coupon exactly as before", () => {
    const result = computeOrderPricing({
      ...base,
      subtotal: 1000,
      coupon: { couponId: "c1", code: "SAVE", discount: 100 },
    });
    assert.equal(result.discount, 100);
    assert.equal(result.total, 1030);
    assert.deepEqual(result.applied, { kind: "coupon", couponId: "c1", code: "SAVE" });
  });

  it("never goes below zero", () => {
    const result = computeOrderPricing({ ...base, subtotal: 100, coupon: { couponId: "c", code: "X", discount: 500 } });
    assert.equal(result.total, 0);
  });
});

describe("promotionDiscount", () => {
  it("takes a percentage, rounded to paisa, capped by maxDiscount", () => {
    assert.equal(promotionDiscount(promo("a", { value: 12.5 }), 999), 124.88);
    assert.equal(promotionDiscount(promo("a", { value: 20, maxDiscount: 300 }), 5000), 300);
  });

  it("never gives more than the subtotal for a fixed amount", () => {
    assert.equal(promotionDiscount(promo("a", { type: "FIXED", value: 500 }), 400), 400);
  });
});

describe("computeOrderPricing with automatic offers", () => {
  it("applies an offer once the subtotal reaches its minimum", () => {
    const promotions = [promo("p", { minOrderAmount: 1500, value: 10 })];
    assert.equal(computeOrderPricing({ ...base, promotions, subtotal: 1499 }).applied, null);
    const result = computeOrderPricing({ ...base, promotions, subtotal: 1500 });
    assert.equal(result.discount, 150);
    assert.equal(result.total, 1500 - 150 + 130);
    assert.deepEqual(result.applied, { kind: "promotion", promotionId: "p", name: "Offer p", freeShipping: false });
  });

  it("removes delivery when the offer includes free delivery", () => {
    const promotions = [promo("p", { type: "FIXED", value: 100, minOrderAmount: 1000, freeShipping: true })];
    const result = computeOrderPricing({ ...base, promotions, subtotal: 1200 });
    assert.equal(result.shippingCost, 0);
    assert.equal(result.total, 1100);
  });

  it("supports a free-delivery-only offer with no money off", () => {
    const promotions = [promo("fd", { type: "FIXED", value: 0, minOrderAmount: 1500, freeShipping: true })];
    const result = computeOrderPricing({ ...base, promotions, subtotal: 1600 });
    assert.equal(result.discount, 0);
    assert.equal(result.shippingCost, 0);
    assert.equal(result.total, 1600);
    assert.equal(result.applied?.kind, "promotion");
    // Already-free delivery means this offer saves nothing, so it is not shown as applied.
    assert.equal(computeOrderPricing({ ...base, promotions, subtotal: 3000 }).applied, null);
  });

  it("picks the tier that saves the most, counting free delivery", () => {
    const promotions = [
      promo("small", { type: "FIXED", value: 100, minOrderAmount: 1000 }),
      promo("delivery", { type: "FIXED", value: 50, minOrderAmount: 1000, freeShipping: true }), // saves 50 + 130
      promo("big", { type: "FIXED", value: 300, minOrderAmount: 3000 }),
    ];
    assert.equal(computeOrderPricing({ ...base, promotions, subtotal: 1200 }).applied?.kind === "promotion" &&
      (computeOrderPricing({ ...base, promotions, subtotal: 1200 }).applied as { promotionId: string }).promotionId, "delivery");
    assert.equal((computeOrderPricing({ ...base, promotions, subtotal: 3000 }).applied as { promotionId: string }).promotionId, "big");
  });

  it("does not count free delivery as a saving when shipping is already free", () => {
    const promotions = [
      promo("delivery", { type: "FIXED", value: 50, freeShipping: true }),
      promo("money", { type: "FIXED", value: 60 }),
    ];
    const result = computeOrderPricing({ ...base, promotions, subtotal: 3000 });
    assert.equal((result.applied as { promotionId: string }).promotionId, "money");
  });

  it("ignores inactive, not-yet-started and expired offers", () => {
    const promotions = [
      promo("off", { isActive: false }),
      promo("future", { startsAt: new Date("2026-10-02T00:00:00Z") }),
      promo("past", { endsAt: new Date("2026-09-30T00:00:00Z") }),
    ];
    assert.equal(computeOrderPricing({ ...base, promotions, subtotal: 5000 }).applied, null);
  });

  it("uses whichever of the code and the offer saves more, never both", () => {
    const promotions = [promo("p", { type: "FIXED", value: 200 })];
    const weakCode = computeOrderPricing({ ...base, promotions, subtotal: 1000, coupon: { couponId: "c", code: "C", discount: 150 } });
    assert.equal(weakCode.applied?.kind, "promotion");
    assert.equal(weakCode.discount, 200);
    const strongCode = computeOrderPricing({ ...base, promotions, subtotal: 1000, coupon: { couponId: "c", code: "C", discount: 250 } });
    assert.equal(strongCode.applied?.kind, "coupon");
    assert.equal(strongCode.discount, 250);
  });

  it("prefers the customer's code when both save the same", () => {
    const promotions = [promo("p", { type: "FIXED", value: 200 })];
    const tie = computeOrderPricing({ ...base, promotions, subtotal: 1000, coupon: { couponId: "c", code: "C", discount: 200 } });
    assert.equal(tie.applied?.kind, "coupon");
  });
});

describe("describePromotion", () => {
  const money = (n: number) => `BDT ${n}`;
  it("describes money off, the cap and free delivery", () => {
    assert.equal(describePromotion(promo("a", { value: 10, maxDiscount: 500, freeShipping: true }), money), "10% off (up to BDT 500) + free delivery");
    assert.equal(describePromotion(promo("a", { type: "FIXED", value: 300 }), money), "BDT 300 off");
    assert.equal(describePromotion(promo("a", { type: "FIXED", value: 0, freeShipping: true }), money), "Free delivery");
  });
});

describe("findNextPromotion", () => {
  const promotions = [
    promo("a", { minOrderAmount: 1000 }),
    promo("b", { minOrderAmount: 3000 }),
    promo("c", { minOrderAmount: 2000, isActive: false }),
  ];

  it("returns the closest offer the cart has not reached yet", () => {
    assert.deepEqual(findNextPromotion(promotions, 1500, NOW), { promotion: promotions[1], amountNeeded: 1500 });
  });

  it("returns null when every offer is already reached", () => {
    assert.equal(findNextPromotion(promotions, 3000, NOW), null);
  });
});

describe("payment-method restricted offers", () => {
  const online = ["BKASH", "NAGAD", "ROCKET"];
  const puja = promo("puja", { name: "Puja Cashback Offer", type: "FIXED", value: 300, minOrderAmount: 2000, allowedPaymentMethods: online });

  it("removes the discount when the customer pays cash on delivery", () => {
    const result = computeOrderPricing({ ...base, promotions: [puja], subtotal: 2500, paymentMethod: "COD" });
    assert.equal(result.applied, null);
    assert.equal(result.discount, 0);
  });

  it("applies the discount for an allowed online method", () => {
    const result = computeOrderPricing({ ...base, promotions: [puja], subtotal: 2500, paymentMethod: "BKASH" });
    assert.equal(result.discount, 300);
    assert.equal(result.applied?.kind, "promotion");
  });

  it("applies offers with no restriction to every method, including cash on delivery", () => {
    const open = promo("open", { type: "FIXED", value: 100, allowedPaymentMethods: [] });
    assert.equal(computeOrderPricing({ ...base, promotions: [open], subtotal: 2500, paymentMethod: "COD" }).discount, 100);
  });

  it("previews the offer when the payment method is not chosen yet (cart)", () => {
    assert.equal(computeOrderPricing({ ...base, promotions: [puja], subtotal: 2500 }).discount, 300);
  });

  it("falls back to an unrestricted offer when the better one needs online payment", () => {
    const open = promo("open", { type: "FIXED", value: 100, allowedPaymentMethods: [] });
    const result = computeOrderPricing({ ...base, promotions: [puja, open], subtotal: 2500, paymentMethod: "COD" });
    assert.equal(result.applied?.kind === "promotion" && result.applied.promotionId, "open");
    assert.equal(result.discount, 100);
  });
});

describe("findOfferBlockedByPayment", () => {
  const online = ["BKASH", "NAGAD", "ROCKET"];
  const puja = promo("puja", { name: "Puja Cashback Offer", type: "FIXED", value: 300, minOrderAmount: 2000, allowedPaymentMethods: online });
  const input = { ...base, promotions: [puja], subtotal: 2500, paymentMethod: "COD" };

  it("tells cash-on-delivery customers which methods unlock the offer and how much they save", () => {
    const blocked = findOfferBlockedByPayment(input);
    assert.ok(blocked);
    assert.equal(blocked.promotion.id, "puja");
    assert.deepEqual(blocked.paymentMethods, online);
    assert.equal(blocked.extraSaving, 300);
  });

  it("returns nothing when the chosen method already gets the offer", () => {
    assert.equal(findOfferBlockedByPayment({ ...input, paymentMethod: "NAGAD" }), null);
  });

  it("returns nothing below the offer minimum", () => {
    assert.equal(findOfferBlockedByPayment({ ...input, subtotal: 1500 }), null);
  });

  it("returns nothing when the customer's coupon already beats the offer", () => {
    assert.equal(findOfferBlockedByPayment({ ...input, coupon: { couponId: "c", code: "BIG", discount: 500 } }), null);
  });
});

describe("paymentRestrictionText", () => {
  it("describes online-only and single-method offers", () => {
    assert.equal(paymentRestrictionText(["BKASH", "NAGAD", "ROCKET"]), "bKash, Nagad or Rocket");
    assert.equal(paymentRestrictionText(["BKASH"]), "bKash");
    assert.equal(paymentRestrictionText([]), "");
  });
});
