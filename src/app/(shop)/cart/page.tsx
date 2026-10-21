import type { Metadata } from "next";
import { getFreeShippingMinimum } from "@/lib/settings";
import { getActivePromotions } from "@/lib/promotions";
import CartClient from "./cart-client";

export const dynamic = "force-dynamic";

// Transactional page: keep it out of search results entirely.
export const metadata: Metadata = {
  title: "Shopping Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const [freeShippingMinimum, promotions] = await Promise.all([
    getFreeShippingMinimum(),
    getActivePromotions(),
  ]);

  return <CartClient freeShippingMinimum={freeShippingMinimum} promotions={promotions} />;
}
