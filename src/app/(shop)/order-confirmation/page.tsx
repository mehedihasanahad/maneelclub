import Link from "next/link";
import { CheckCircle, Package, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { siteConfig, PAYMENT_METHODS } from "@/lib/constants";
import { getOrderByNumber } from "@/actions/orders";
import { getOrderPromotion } from "@/lib/promotions";
import { PurchaseEventTracker } from "@/components/analytics";
import type { Metadata } from "next";

// Shows a customer's order number and details: never index, never follow.
export const metadata: Metadata = {
  title: "Order Confirmation",
  robots: { index: false, follow: false },
};

interface OrderConfirmationPageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function OrderConfirmationPage({ searchParams }: OrderConfirmationPageProps) {
  const { order: orderNumber } = await searchParams;
  
  if (!orderNumber) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">No Order Found</h1>
        <p className="text-muted-foreground mb-8">
          We couldnt find your order. Please contact support if you need help.
        </p>
        <Button asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    );
  }

  const result = await getOrderByNumber(orderNumber);
  const order = result.success ? result.data : null;

  if (!order) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
        <p className="text-muted-foreground mb-8">
          We could not find an order with that number. Please check the link or contact support.
        </p>
        <Button asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    );
  }

  const paymentMethod = order.paymentMethod;
  const paymentLabel = PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label ?? paymentMethod;
  const isCod = paymentMethod === "COD";
  // Automatic offer name for the discount line (null when a code was used or there was no offer).
  const orderPromotion = order.coupon ? null : await getOrderPromotion(order.id);

  const orderValue = Number(order.total);
  const numItems = order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const contentIds = order.items?.map((i) => i.productId) ?? [];

  return (
    <div className="container py-12 max-w-2xl mx-auto">
      <PurchaseEventTracker
        orderNumber={orderNumber}
        value={orderValue}
        numItems={numItems}
        contentIds={contentIds}
      />
      {/* Success Icon */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-green-600 mb-2">
          Order Placed Successfully!
        </h1>
        <p className="text-muted-foreground mb-3">
          Thank you for your order.
        </p>
        <p className="text-base font-medium text-foreground bg-muted/60 inline-block px-4 py-2 rounded-lg border border-border">
          We will call you within 24 hours to confirm your order.
        </p>
      </div>

      {/* Order Details Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground">Order Number</span>
            <span className="font-mono font-bold text-lg">{orderNumber}</span>
          </div>
          {order.discountAmount != null && Number(order.discountAmount) > 0 && (
            <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400 mb-2">
              <span>
                Discount
                {order.coupon?.code
                  ? ` (${order.coupon.code})`
                  : orderPromotion
                    ? ` (${orderPromotion.name})`
                    : ""}
              </span>
              <span>−{Number(order.discountAmount).toLocaleString()} BDT</span>
            </div>
          )}
          <Separator className="my-4" />
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">What&apos;s Next?</p>
                <p className="text-sm text-muted-foreground">
                  We will call you within 24 hours to confirm your order and delivery details.
                  Your order will be delivered within 2-5 business days.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Need Help?</p>
                <p className="text-sm text-muted-foreground">
                  Contact us on WhatsApp for any queries about your order.
                </p>
                <a
                  href={`https://wa.me/${siteConfig.whatsapp.replace("+", "")}?text=Hi, I want to check my order: ${orderNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {siteConfig.whatsapp}
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment info – depends on method */}
      <Card className="mb-8 bg-muted/50">
        <CardContent className="p-6">
          <h3 className="font-medium mb-2">Payment: {paymentLabel}</h3>
          {isCod ? (
            <p className="text-sm text-muted-foreground">
              Please keep the exact amount ready. Our delivery partner will collect 
              the payment when delivering your order.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              We have received your payment details. Our team will verify your 
              payment and confirm your order shortly. You will be notified once 
              the payment is verified.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild className="flex-1">
          <Link href="/shop">Continue Shopping</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a
            href={`https://wa.me/${siteConfig.whatsapp.replace("+", "")}?text=Hi, I just placed order ${orderNumber}. Please confirm.`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact on WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
