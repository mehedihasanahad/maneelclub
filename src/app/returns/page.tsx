import type { Metadata } from "next";
import { siteConfig } from "@/lib/constants";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Return & Exchange Policy",
  description: "Maneel Club Return & Exchange Policy – damaged items, size exchange, and conditions.",
  alternates: canonical("/returns"),
};

export default function ReturnsPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-bold mb-2">Maneel Club Return & Exchange Policy</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm mt-6">
        <p>
          At {siteConfig.name}, we are committed to delivering high-quality products that you&apos;ll love. Our goal is to ensure your complete satisfaction with every purchase. Please read our policy carefully to understand your options for returns and exchanges.
        </p>
        <p>
          We do not offer cash refunds. Instead, we are happy to facilitate an exchange for a new product under the following conditions.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">For Online Purchases</h2>

        <h3 className="text-lg font-semibold mt-6 mb-2">1. Damaged or Defective Items</h3>
        <p>
          We take great care to ensure your order is perfect before it leaves our studio. However, in the rare event that your product arrives with a major defect or is significantly damaged, please follow this crucial procedure:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Immediate Inspection is Required:</strong> You must inspect the product in the presence of the delivery man.</li>
          <li><strong>Immediate Action:</strong> If you discover a major defect or damage, show it to the delivery person and immediately reject the product or call us in front of the delivery man to solve the issue.</li>
          <li><strong>What to Do Next:</strong> The delivery person will mark the item as rejected due to damage, then process an exchange and we&apos;ll send you a new, fresh product as soon as possible, at no additional cost to you. When you receive the new one you have to exchange with your old one to the delivery person.</li>
        </ul>
        <p className="font-medium">
          Please Note: We cannot accept any requests for exchange for damaged or defective items once the delivery person has left and the package has been accepted by you. This policy is in place to ensure that any issues are verified at the time of delivery.
        </p>

        <h3 className="text-lg font-semibold mt-6 mb-2">2. Size Exchange</h3>
        <p>
          We understand that finding the perfect fit can be challenging. If you received a product that fits incorrectly, we are happy to exchange it for a different size, provided the item is:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Unused and Unworn:</strong> The product must be in its original condition with all tags and labels still attached.</li>
          <li><strong>Free of Defects:</strong> The product must have no signs of wear, stains, or any other damage.</li>
        </ul>
        <p className="mt-2 font-medium">How to Request a Size Exchange:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Contact Us:</strong> Please contact our Facebook page or emergency call us within 24 hours of receiving your order to initiate a size exchange.</li>
          <li><strong>Wait for Approval:</strong> Our team will review your request and provide you with instructions on how to return the item.</li>
          <li><strong>Return Shipping:</strong> You will be responsible for the shipping costs to send the item back to us with taking the new one.</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6 mb-2">Important Details</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>All exchanges are subject to product availability. If the desired size is out of stock, we will issue a store credit.</li>
          <li>This policy applies only to online purchases. For in-store purchases, please refer to the policy displayed at the point of sale.</li>
          <li>We reserve the right to refuse any exchange that does not meet the above conditions.</li>
        </ul>

        <p className="mt-8">
          Thank you for choosing {siteConfig.name}. We appreciate your understanding and cooperation with our policies. If you have any questions, please do not hesitate to contact our support team.
        </p>
      </div>
    </div>
  );
}
