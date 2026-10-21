import type { Metadata } from "next";
import { siteConfig } from "@/lib/constants";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Maneel Club Terms of Service – terms and conditions for using our website and services.",
  alternates: canonical("/terms"),
};

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Effective Date: February 6, 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm">
        <p>
          Welcome to {siteConfig.name}. By accessing or using our website and services, you agree to be bound by these Terms of Service. Please read them carefully.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">1. Use of Our Website</h2>
        <p>
          You may use our website for lawful purposes only. You agree not to use the site in any way that could damage, disable, or impair it or interfere with any other party&apos;s use of the site.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">2. Orders and Payment</h2>
        <p>
          All orders are subject to product availability and acceptance. We reserve the right to refuse or cancel any order. Prices are in Bangladeshi Taka (BDT) unless otherwise stated. Payment methods include Cash on Delivery (COD) and mobile financial services (bKash, Nagad, Rocket) as indicated at checkout.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">3. Shipping and Delivery</h2>
        <p>
          We ship across Bangladesh. Delivery times and shipping costs depend on your location. Risk of loss and title for items pass to you upon delivery to the carrier.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">4. Returns and Exchanges</h2>
        <p>
          Our Return &amp; Exchange Policy applies to all purchases. We do not offer cash refunds; exchanges are subject to the conditions described in our <a href="/returns" className="text-primary hover:underline">Return &amp; Exchange Policy</a>.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">5. Intellectual Property</h2>
        <p>
          All content on this website, including text, graphics, logos, and images, is the property of {siteConfig.name} or its content suppliers and is protected by applicable intellectual property laws.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">6. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, {siteConfig.name} shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the site or any products purchased through it.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">7. Changes</h2>
        <p>
          We may update these Terms of Service from time to time. We will post any changes on this page with an updated effective date. Your continued use of the site after changes constitutes acceptance of the revised terms.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">8. Contact</h2>
        <p>
          For questions about these Terms of Service, please contact us at{" "}
          <a href="mailto:maneelclub@gmail.com" className="text-primary hover:underline">maneelclub@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}
