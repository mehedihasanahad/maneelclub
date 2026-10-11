"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/lib/format";
import {
  computeOrderPricing,
  describePromotion,
  findNextPromotion,
  paymentRestrictionText,
  type Promotion,
} from "@/lib/pricing";

interface CartClientProps {
  /** Free Shipping Minimum setting. 0 means free shipping is disabled. */
  freeShippingMinimum: number;
  /** Active automatic offers ("spend X, get Y"). */
  promotions: Promotion[];
}

export default function CartClient({ freeShippingMinimum, promotions }: CartClientProps) {
  const [pricingNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const { items, updateQuantity, removeItem, getSubtotal } = useCartStore();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Wait for hydration before showing cart content
  useEffect(() => {
    setMounted(true);
  }, []);

  const subtotal = getSubtotal();
  // Free shipping is disabled when the minimum is 0 (must match checkout-client and createOrder).
  const freeShippingEnabled = freeShippingMinimum > 0;
  // Delivery zone is unknown here, so price with no delivery charge: this shows the offer's
  // discount and whether it includes free delivery; checkout adds the zone rate.
  const pricing = computeOrderPricing({
    subtotal,
    zoneRate: 0,
    freeShippingMinimum,
    coupon: null,
    promotions,
    now: pricingNow,
  });
  const offer = pricing.applied?.kind === "promotion" ? pricing.applied : null;
  // Payment is chosen at checkout, so an offer limited to some methods is previewed here with a note.
  const offerPaymentMethods = offer
    ? (promotions.find((p) => p.id === offer.promotionId)?.allowedPaymentMethods ?? [])
    : [];
  const nextOffer = findNextPromotion(promotions, subtotal, pricingNow);
  const qualifiesForFreeShipping =
    (freeShippingEnabled && subtotal >= freeShippingMinimum) || Boolean(offer?.freeShipping);
  const total = subtotal - pricing.discount;

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    setIsUpdating(itemId);
    updateQuantity(itemId, newQuantity);
    setTimeout(() => setIsUpdating(null), 300);
  };

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="container py-8 md:py-12">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-8 w-24 mt-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full mt-4" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">
            Looks like you haven't added anything to your cart yet.
            Start shopping to fill it up!
          </p>
          <Button size="lg" asChild>
            <Link href="/shop">
              Start Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">Shopping Cart</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <Link
                    href={`/product/${item.slug}`}
                    className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-muted"
                  >
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized={item.image.startsWith("/uploads/")}
                    />
                  </Link>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug}`}
                      className="font-medium hover:text-primary line-clamp-2"
                    >
                      {item.title}
                    </Link>

                    <div className="text-sm text-muted-foreground mt-1">
                      <span>Color: {item.color}</span>
                      <span className="mx-2">•</span>
                      <span>Size: {item.size}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
                      {/* Quantity Controls */}
                      <div className="flex items-center border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-r-none"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || isUpdating === item.id}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isUpdating === item.id}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Price */}
                      <span className="font-bold text-lg">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Continue Shopping Link */}
          <div className="pt-4">
            <Link
              href="/product-category/all"
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Continue Shopping
            </Link>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal ({items.length} {items.length === 1 ? "item" : "items"})
                  </span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>

                {offer && pricing.discount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount ({offer.name})</span>
                    <span className="font-medium">−{formatPrice(pricing.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">
                    {qualifiesForFreeShipping ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      "Calculated at checkout"
                    )}
                  </span>
                </div>

                {offer && (
                  <p className="flex items-start gap-2 rounded bg-green-50 p-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-200">
                    <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {offer.name} unlocked. No code needed.
                      {offerPaymentMethods.length > 0 &&
                        ` Applies when you pay with ${paymentRestrictionText(offerPaymentMethods)}.`}
                    </span>
                  </p>
                )}

                {nextOffer ? (
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    Add {formatPrice(nextOffer.amountNeeded)} more to get{" "}
                    <span className="font-medium text-foreground">
                      {describePromotion(nextOffer.promotion, formatPrice)}
                    </span>
                    {nextOffer.promotion.allowedPaymentMethods.length > 0 &&
                      ` with ${paymentRestrictionText(nextOffer.promotion.allowedPaymentMethods)} payment`}
                    .
                  </p>
                ) : (
                  !qualifiesForFreeShipping &&
                  freeShippingEnabled &&
                  subtotal < freeShippingMinimum && (
                    <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                      Add {formatPrice(freeShippingMinimum - subtotal)} more for free shipping!
                    </p>
                  )
                )}

                <Separator className="my-4" />

                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <Button size="lg" className="w-full mt-6" asChild>
                <Link href="/checkout">
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Shipping & taxes calculated at checkout
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
