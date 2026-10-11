"use server";

import { db } from "@/lib/db";
import { getShippingRates, getFreeShippingMinimum, getOrderCooldownSettings } from "@/lib/settings";
import { checkoutSchema, CheckoutFormData } from "@/schemas/checkout";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { runAndSaveCourierCheck } from "@/lib/courier-check";
import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { sendPurchaseEvent } from "@/lib/conversions-api";
import { getMetaCapiSettings } from "@/lib/settings";
import { getClientIp } from "@/lib/client-ip";
import { isIpBanned } from "@/lib/ip-ban";
import { isPhoneBanned } from "@/lib/phone-ban";
import { attributionSchema } from "@/schemas/attribution";
import { computeOrderPricing, type AppliedCoupon } from "@/lib/pricing";
import { getActivePromotions } from "@/lib/promotions";

/** Thrown inside the order transaction when a limited coupon was used up by a concurrent order. */
class CouponLimitReachedError extends Error {}

interface CartItem {
  productId: string;
  title: string;
  image: string;
  price: number;
  color: string;
  size: string;
  quantity: number;
  variantId?: string;
}

/** Server-resolved line item: price and stock validated from DB; used for order creation. */
interface ResolvedLineItem {
  productId: string;
  title: string;
  image: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  variantId?: string;
}

interface CreateOrderInput {
  formData: CheckoutFormData;
  items: CartItem[];
  /** Optional: coupon ID from validateCoupon. Server re-validates and applies discount. */
  couponId?: string | null;
  /** Optional: traffic attribution captured client-side. Never trusted; validated below. */
  attribution?: unknown;
}

/** Resolved attribution columns, or all-null when absent/invalid. */
interface ResolvedAttribution {
  sourceChannel: string | null;
  firstSourceChannel: string | null;
  attribution: Prisma.InputJsonValue | undefined;
}

/**
 * Validate client-supplied attribution. Analytics data must never block an order,
 * so any problem degrades to nulls rather than throwing.
 */
function resolveAttribution(input: unknown): ResolvedAttribution {
  const empty: ResolvedAttribution = {
    sourceChannel: null,
    firstSourceChannel: null,
    attribution: undefined,
  };

  try {
    if (!input) return empty;

    const parsed = attributionSchema.safeParse(input);
    if (!parsed.success) return empty;

    const { first, last } = parsed.data;
    if (!first && !last) return empty;

    return {
      sourceChannel: last?.channel ?? first?.channel ?? null,
      firstSourceChannel: first?.channel ?? last?.channel ?? null,
      attribution: { first, last } as unknown as Prisma.InputJsonValue,
    };
  } catch {
    return empty;
  }
}

/** Result of createOrder: success with order ids, or failure with error and optional code/cooldown. */
export type CreateOrderResult =
  | { success: true; data: { orderId: string; orderNumber: string } }
  | {
      success: false;
      error: string;
      code?: "COOLDOWN" | "IP_BANNED" | "PHONE_BANNED";
      cooldownRemainingSeconds?: number;
      cooldownMinutes?: number;
    };

/**
 * Resolve cart items against the database: validate product exists and is active,
 * resolve variant (for variable products), enforce stock, and return server-side prices.
 * Never trust client-supplied price or quantity for totals.
 */
async function resolveCartItems(items: CartItem[]): Promise<
  { success: true; resolved: ResolvedLineItem[] } | { success: false; error: string }
> {
  const resolved: ResolvedLineItem[] = [];

  for (const item of items) {
    if (item.quantity < 1) {
      return { success: false, error: `Invalid quantity for ${item.title || item.productId}` };
    }

    const product = await db.product.findUnique({
      where: { id: item.productId },
      include: {
        variants: {
          include: {
            attributes: {
              include: {
                attributeValue: { include: { attribute: true } },
              },
            },
          },
        },
      },
    });

    if (!product) {
      return { success: false, error: `Product not found: ${item.title || item.productId}` };
    }
    if (!product.isActive) {
      return { success: false, error: `Product is no longer available: ${product.title}` };
    }

    const regularPrice = Number(product.regularPrice?.toString() ?? 0);
    const salePrice = product.salePrice != null ? Number(product.salePrice.toString()) : null;
    const productPrice = salePrice != null && salePrice < regularPrice ? salePrice : regularPrice;

    if (product.productType === "VARIABLE" && product.variants.length > 0) {
      const matchingVariant = product.variants.find((variant) => {
        const variantAttributes = variant.attributes.map(
          (attr) => attr.attributeValue.displayValue.toLowerCase()
        );
        return (
          variantAttributes.includes(item.color.toLowerCase()) &&
          variantAttributes.includes(item.size.toLowerCase())
        );
      });

      if (!matchingVariant) {
        return {
          success: false,
          error: `Variant (${item.color} / ${item.size}) not found for ${product.title}`,
        };
      }

      const variantStock = matchingVariant.stock ?? 0;
      if (variantStock < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${product.title} (${item.color} / ${item.size}). Available: ${variantStock}`,
        };
      }

      const variantPrice = matchingVariant.price != null ? Number(matchingVariant.price.toString()) : null;
      const effectivePrice = variantPrice ?? productPrice;

      resolved.push({
        productId: item.productId,
        title: product.title,
        image: item.image || (product.images?.[0] ?? ""),
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: effectivePrice,
        variantId: matchingVariant.id,
      });
    } else {
      const stock = product.stock ?? 0;
      if (stock < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${product.title}. Available: ${stock}`,
        };
      }

      resolved.push({
        productId: item.productId,
        title: product.title,
        image: item.image || (product.images?.[0] ?? ""),
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: productPrice,
      });
    }
  }

  return { success: true, resolved };
}

/**
 * Deduct stock for order items (called inside transaction with resolved items).
 */
async function deductStockInTransaction(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  items: ResolvedLineItem[]
) {
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }
  }
}

/**
 * Log stock deduction to StockMovement (call inside same transaction after deduct).
 */
async function logStockDeductInTransaction(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  items: ResolvedLineItem[],
  orderId: string,
  orderNumber: string
) {
  for (const item of items) {
    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        variantId: item.variantId ?? null,
        delta: -item.quantity,
        reason: "ORDER_CREATED",
        orderId,
        orderNumber,
      },
    });
  }
}

/**
 * Create a new order (saves to database)
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  try {
    // Validate form data
    const validatedData = checkoutSchema.safeParse(input.formData);
    
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid form data",
      };
    }
    
    const { items, formData } = input;

    if (!items || items.length === 0) {
      return {
        success: false,
        error: "No items in cart",
      };
    }

    // Resolve all cart items server-side: validate products, variants, stock, and get authoritative prices
    const resolution = await resolveCartItems(items);
    if (!resolution.success) {
      return { success: false, error: resolution.error };
    }
    const resolvedItems = resolution.resolved;

    // Get user if logged in
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      userId = session?.user?.id || null;
    } catch {
      // User not logged in, that's fine for guest checkout
    }

    // Calculate totals from server-resolved prices (never from client)
    const subtotal = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const [rates, freeShippingMinimum] = await Promise.all([
      getShippingRates(),
      getFreeShippingMinimum(),
    ]);
    const zoneRate = formData.shippingZone === "inside_dhaka" ? rates.dhaka : rates.outside;

    // Validate the customer's coupon code (server-side; unchanged rules)
    let validatedCoupon: AppliedCoupon | null = null;
    let couponMaxUses: number | null = null;
    if (input.couponId?.trim()) {
      const coupon = await db.coupon.findUnique({
        where: { id: input.couponId.trim(), isActive: true },
      });
      if (coupon) {
        const now = new Date();
        const ok =
          (!coupon.validFrom || now >= coupon.validFrom) &&
          (!coupon.validUntil || now <= coupon.validUntil) &&
          (coupon.maxUses == null || coupon.usedCount < coupon.maxUses) &&
          (coupon.minOrderAmount == null || Number(coupon.minOrderAmount) <= subtotal);
        if (ok) {
          const val = Number(coupon.value);
          const couponDiscount =
            coupon.type === "PERCENT"
              ? Math.round((subtotal * val) / 100 * 100) / 100
              : Math.min(val, subtotal);
          if (couponDiscount > 0) {
            validatedCoupon = { couponId: coupon.id, code: coupon.code, discount: couponDiscount };
            couponMaxUses = coupon.maxUses;
          }
        }
      }
    }

    // Discount, delivery and total: same function the checkout page uses to display them.
    // Automatic offers come back empty if their table is missing, so pricing then matches the old rules.
    const pricing = computeOrderPricing({
      subtotal,
      zoneRate,
      freeShippingMinimum,
      coupon: validatedCoupon,
      promotions: await getActivePromotions(),
      now: new Date(),
      // Offers limited to certain payment methods only apply when the chosen method is allowed.
      paymentMethod: formData.paymentMethod || "COD",
    });
    const { shippingCost, total } = pricing;
    const discountAmount = pricing.discount;
    const couponId = pricing.applied?.kind === "coupon" ? pricing.applied.couponId : null;
    const appliedPromotion = pricing.applied?.kind === "promotion" ? pricing.applied : null;
    
    // Determine payment method and status
    const paymentMethod = (formData.paymentMethod || "COD") as PaymentMethod;
    // All orders start as PROCESSING order status and PENDING payment status
    // COD orders will be marked PAID on delivery
    // Mobile payments will be verified by admin
    const paymentStatus: PaymentStatus = "PENDING";

    const h = await headers();
    const clientIp = getClientIp(h);
    const attribution = resolveAttribution(input.attribution);

    // IP ban: blocked IPs cannot place orders
    if (clientIp && (await isIpBanned(clientIp))) {
      return {
        success: false,
        error: "Unable to place an order. Please contact support.",
        code: "IP_BANNED",
      };
    }

    // Phone ban: blocked phone numbers cannot place orders
    if (await isPhoneBanned(formData.phone)) {
      return {
        success: false,
        error: "Unable to place an order. Please contact support.",
        code: "PHONE_BANNED",
      };
    }

    // Order cooldown: same phone cannot order again within X minutes (when enabled)
    const cooldown = await getOrderCooldownSettings();
    if (cooldown.enabled) {
      const lastOrder = await db.order.findFirst({
        where: { customerPhone: formData.phone },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (lastOrder) {
        const windowMs = cooldown.minutes * 60 * 1000;
        const elapsed = Date.now() - lastOrder.createdAt.getTime();
        if (elapsed < windowMs) {
          const cooldownRemainingSeconds = Math.ceil((windowMs - elapsed) / 1000);
          return {
            success: false,
            error: "You already placed an order. Please wait before placing another.",
            code: "COOLDOWN",
            cooldownRemainingSeconds,
            cooldownMinutes: cooldown.minutes,
          };
        }
      }
    }

    // Create order in database using a transaction to ensure stock deduction is atomic
    const order = await db.$transaction(async (tx) => {
      // Next serial order number (numeric only, starting from 2000)
      const rows = await tx.$queryRaw<Array<{ orderNumber: string }>>(
        Prisma.sql`SELECT "orderNumber" FROM "Order" WHERE "orderNumber" ~ '^[0-9]+$' ORDER BY ("orderNumber"::integer) DESC LIMIT 1`
      );
      const lastNum = rows[0] ? parseInt(rows[0].orderNumber, 10) : 1999;
      const orderNumber = String(Math.max(2000, lastNum + 1));

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          clientIp,
          sourceChannel: attribution.sourceChannel,
          firstSourceChannel: attribution.firstSourceChannel,
          attribution: attribution.attribution,
          customerName: formData.fullName,
          customerEmail: formData.email || null,
          customerPhone: formData.phone,
          shippingAddress: formData.address,
          city: formData.city,
          altPhone: formData.altPhone || null,
          deliveryNote: formData.deliveryNote || null,
          shippingCost,
          subtotal,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          total,
          status: "PROCESSING",
          couponId: couponId ?? undefined,
          // Payment fields
          paymentMethod,
          paymentStatus,
          senderNumber: formData.senderNumber || null,
          transactionId: formData.transactionId || null,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              color: item.color,
              size: item.size,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      if (couponId) {
        // Checked again inside the transaction so two simultaneous orders cannot both take
        // the last use of a limited coupon.
        const used = await tx.coupon.updateMany({
          where: {
            id: couponId,
            ...(couponMaxUses != null ? { usedCount: { lt: couponMaxUses } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0) throw new CouponLimitReachedError();
      }

      if (appliedPromotion) {
        // Only reached when offers were read successfully, so the tables exist.
        await tx.orderPromotion.create({
          data: {
            orderId: newOrder.id,
            promotionId: appliedPromotion.promotionId,
            name: appliedPromotion.name,
            discountAmount,
            freeShipping: appliedPromotion.freeShipping,
          },
        });
        await tx.promotion.update({
          where: { id: appliedPromotion.promotionId },
          data: { usedCount: { increment: 1 } },
        });
      }

      await deductStockInTransaction(tx, resolvedItems);
      await logStockDeductInTransaction(tx, resolvedItems, newOrder.id, newOrder.orderNumber);
      return newOrder;
    });

    // Revalidate relevant paths
    revalidatePath("/admin/orders");
    revalidatePath("/admin/products");
    if (userId) {
      revalidatePath("/dashboard/orders");
    }

    // Auto-run the BDCourier fraud check in the background so admins don't have to
    // click refresh per order. Runs after the response is sent (after()) since the
    // BDCourier API is slow (10-30s) and must not block the customer's checkout.
    after(() => runAndSaveCourierCheck(order.id));

    // Meta Conversions API: send Purchase for deduplication with Pixel (use orderNumber as event_id)
    // Credentials from env or admin settings (configure after deployment)
    try {
      const clientUserAgent = h.get("user-agent") ?? undefined;
      const capiSettings = await getMetaCapiSettings();
      const credentials =
        capiSettings.pixelId && capiSettings.accessToken
          ? { pixelId: capiSettings.pixelId, accessToken: capiSettings.accessToken }
          : undefined;
      await sendPurchaseEvent({
        order_id: order.orderNumber,
        value: Number(order.total),
        currency: "BDT",
        num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
        content_ids: order.items.map((i) => i.productId),
        email: order.customerEmail ?? formData.email ?? null,
        phone: order.customerPhone ?? formData.phone ?? null,
        client_ip_address: clientIp ?? null,
        client_user_agent: clientUserAgent ?? null,
        ...(credentials && { _credentials: credentials }),
      });
    } catch (e) {
      console.warn("[Conversions API] Purchase event failed:", e);
    }

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    };
  } catch (error) {
    if (error instanceof CouponLimitReachedError) {
      return {
        success: false,
        error: "This discount code has just reached its usage limit. Remove it and place your order again.",
      };
    }
    console.error("Error creating order:", error);
    return {
      success: false,
      error: "Failed to create order. Please try again.",
    };
  }
}

/**
 * Check if the current request (by IP) is allowed to place an order.
 * Used by checkout page to show cooldown countdown or block without submitting.
 * Does not return raw IP to client.
 */
export async function getCheckoutEligibility(): Promise<{
  allowed: boolean;
  error?: string;
  code?: "COOLDOWN" | "IP_BANNED";
  cooldownRemainingSeconds?: number;
  cooldownMinutes?: number;
}> {
  try {
    const h = await headers();
    const clientIp = getClientIp(h);

    if (clientIp && (await isIpBanned(clientIp))) {
      return {
        allowed: false,
        error: "Unable to place an order. Please contact us for assistance.",
        code: "IP_BANNED",
      };
    }

    // Phone-based cooldown and phone ban are checked at order submission time
    // since the phone number is not available until the form is submitted.

    return { allowed: true };
  } catch (error) {
    console.error("Error checking checkout eligibility:", error);
    return { allowed: true }; // Fail open so checkout is not broken
  }
}

/**
 * Get order by order number
 */
export async function getOrderByNumber(orderNumber: string) {
  try {
    const order = await db.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        coupon: true,
      },
    });
    
    if (!order) {
      return {
        success: false,
        error: "Order not found",
        data: null,
      };
    }
    
    return {
      success: true,
      data: order,
    };
  } catch (error) {
    console.error("Error fetching order:", error);
    return {
      success: false,
      error: "Failed to fetch order",
      data: null,
    };
  }
}

/**
 * Get orders for current user (optionally limited for recent orders)
 */
export async function getUserOrders(limit?: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "Not authenticated",
        data: [],
      };
    }

    const orders = await db.order.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(limit != null && { take: limit }),
    });

    // Serialize Decimal fields to numbers (required when passing to Client Components)
    const serializedOrders = orders.map((order) => ({
      ...order,
      shippingCost: Number(order.shippingCost),
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      items: order.items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: Number(item.price),
        title: item.product?.title ?? "",
        product: item.product
          ? {
              ...item.product,
              regularPrice: Number(item.product.regularPrice),
              salePrice: item.product.salePrice ? Number(item.product.salePrice) : null,
            }
          : null,
      })),
    }));
    
    return {
      success: true,
      data: serializedOrders,
    };
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return {
      success: false,
      error: "Failed to fetch orders",
      data: [],
    };
  }
}

/**
 * Get a single order by id for the current user (dashboard order details).
 * Returns 404 if order not found or not owned by the user.
 */
export async function getOrderForUser(orderId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "Not authenticated",
        data: null,
      };
    }

    const order = await db.order.findFirst({
      where: {
        id: orderId,
        userId: session.user.id,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: "Order not found",
        data: null,
      };
    }

    const serialized = {
      ...order,
      shippingCost: Number(order.shippingCost),
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      items: order.items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: Number(item.price),
        title: item.product?.title ?? "",
        product: item.product
          ? {
              ...item.product,
              regularPrice: Number(item.product.regularPrice),
              salePrice: item.product.salePrice ? Number(item.product.salePrice) : null,
            }
          : null,
      })),
    };

    return {
      success: true,
      data: serialized,
    };
  } catch (error) {
    console.error("Error fetching order:", error);
    return {
      success: false,
      error: "Failed to fetch order",
      data: null,
    };
  }
}
