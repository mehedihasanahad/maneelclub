import type { Metadata } from "next";
import { getMerchantNumbers, getShippingRates, getFreeShippingMinimum, getWhatsappNumber } from "@/lib/settings";
import { getCities } from "@/actions/cities";
import { getCheckoutEligibility } from "@/actions/orders";
import { getActivePromotions } from "@/lib/promotions";
import CheckoutClient from "./checkout-client";

export const dynamic = "force-dynamic";

// Transactional page: keep it out of search results entirely.
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [merchantNumbers, shippingRates, cities, freeShippingMinimum, eligibility, whatsappNumber, promotions] =
    await Promise.all([
      getMerchantNumbers(),
      getShippingRates(),
      getCities(),
      getFreeShippingMinimum(),
      getCheckoutEligibility(),
      getWhatsappNumber(),
      getActivePromotions(),
    ]);

  return (
    <CheckoutClient
      merchantNumbers={merchantNumbers}
      shippingRates={shippingRates}
      cities={cities}
      freeShippingMinimum={freeShippingMinimum}
      eligibility={eligibility}
      whatsappNumber={whatsappNumber}
      promotions={promotions}
    />
  );
}
