import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/constants";
import { SHIPPING_RATES } from "@/lib/constants";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Shipping Info",
  description: `Shipping information and delivery for ${siteConfig.name}.`,
  alternates: canonical("/shipping"),
};

export default function ShippingPage() {
  return (
    <div className="container max-w-2xl py-12 md:py-16">
      <h1 className="text-3xl font-bold mb-2">Shipping Info</h1>
      <p className="text-muted-foreground mb-8">
        We deliver across Bangladesh. Shipping is calculated at checkout based on your location.
      </p>
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <p className="font-medium">Dhaka</p>
          <p className="text-muted-foreground">{siteConfig.currencySymbol}{SHIPPING_RATES.dhaka} delivery charge</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-medium">Outside Dhaka</p>
          <p className="text-muted-foreground">{siteConfig.currencySymbol}{SHIPPING_RATES.outside} delivery charge</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Delivery times may vary. You can track your order from your account or via the confirmation email.
        </p>
      </div>
      <Button asChild className="mt-8">
        <Link href="/shop">Shop Now</Link>
      </Button>
    </div>
  );
}
