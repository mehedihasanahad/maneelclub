import type { Metadata } from "next";
import { siteConfig } from "@/lib/constants";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Maneel Club Privacy Policy – how we collect, use, and protect your information.",
  alternates: canonical("/privacy"),
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-bold mb-2">Maneel Club Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Effective Date: February 6, 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm">
        <p>
          Welcome to {siteConfig.name}! We&apos;re committed to creating unique, high-quality clothing and protecting the privacy of our customers. This policy explains how we collect, use, and share your personal information when you shop with us, whether it&apos;s on our website, through our mobile app, or in our physical stores.
        </p>
        <p>By using our services, you agree to the terms of this Privacy Policy.</p>

        <h2 className="text-xl font-semibold mt-8 mb-2">1. Information We Collect</h2>
        <p>
          We only collect information necessary to provide you with the best possible shopping experience. The data we collect falls into a few categories:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Information You Provide Directly:</strong></li>
          <ul className="list-circle pl-6 mt-1 space-y-1">
            <li><strong>Contact & Account Details:</strong> Your name, email address, phone number, shipping and billing addresses when you make a purchase or create an account.</li>
            <li><strong>Payment Information:</strong> Your credit card number, expiration date, and security code are processed by our secure third-party payment partners. {siteConfig.name} does not store your full payment card details.</li>
            <li><strong>Communications:</strong> Information you share when you contact our customer service team, leave a review, or participate in a survey.</li>
          </ul>
          <li><strong>Information We Collect Automatically:</strong></li>
          <ul className="list-circle pl-6 mt-1 space-y-1">
            <li><strong>Website & App Usage Data:</strong> When you browse our website, we automatically collect data about your device and activity, such as your IP address, browser type, pages viewed, time spent on our site, and your shopping cart contents. We use cookies and similar tracking technologies to do this.</li>
          </ul>
          <li><strong>Information We Collect In-Store:</strong></li>
          <ul className="list-circle pl-6 mt-1 space-y-1">
            <li><strong>Transaction Data:</strong> Details of your purchases, including items, date, and time.</li>
            <li><strong>Security Footage:</strong> For security purposes and loss prevention, our physical stores are equipped with video surveillance. We collect this footage to protect our property and our customers.</li>
          </ul>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">2. How We Use Your Information</h2>
        <p>Your information allows us to run our business and give you a great experience. We use your data to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Fulfill Your Orders:</strong> To process your payment, ship your items, and send you order and shipping confirmations.</li>
          <li><strong>Manage Your Account:</strong> To allow you to access your purchase history, save your addresses, and manage your preferences.</li>
          <li><strong>Improve Our Products:</strong> To analyze what our customers love and to develop new and exciting designs.</li>
          <li><strong>Communicate with You:</strong> To send you marketing messages about new arrivals, sales, and special events. You can opt out of these at any time by clicking the &quot;unsubscribe&quot; link in the email.</li>
          <li><strong>Provide Customer Support:</strong> To respond to your questions, process returns, and resolve any issues.</li>
          <li><strong>Maintain Security:</strong> To detect and prevent fraudulent transactions and ensure the security of our website and physical locations.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">3. How We Share Your Information</h2>
        <p>
          We do not sell your personal information. We only share it with trusted third parties who help us operate our brand:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Service Providers:</strong> We share information with companies that perform services on our behalf, such as payment processors, shipping carriers, and marketing platforms. These partners are legally required to protect your information and can only use it for the purposes we specify.</li>
          <li><strong>Legal & Law Enforcement:</strong> We may disclose your information if required by law, court order, or to protect our rights or the safety of others.</li>
          <li><strong>Business Transfers:</strong> If {siteConfig.name} were to be acquired by or merge with another company, your information would be part of the transferred assets.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">4. Your Rights and Choices</h2>
        <p>You have control over your data. Here&apos;s what you can do:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Access & Correction:</strong> You can review and update your personal information by logging into your account.</li>
          <li><strong>Opt-Out of Marketing:</strong> You can unsubscribe from our marketing emails at any time. We&apos;ll still send you non-promotional emails related to your orders or account.</li>
          <li><strong>Do Not Track:</strong> Our website does not currently respond to &quot;Do Not Track&quot; signals.</li>
          <li><strong>Data Deletion:</strong> You can request the deletion of your personal data. We will honor your request unless we need to retain the information for legal or business purposes.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">5. Data Security</h2>
        <p>
          We take the security of your information seriously. We use industry-standard security measures, including SSL encryption for online transactions, to protect your data from unauthorized access, use, or disclosure. However, no method of transmission over the internet is 100% secure, so we cannot guarantee absolute security.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">6. Children&apos;s Privacy</h2>
        <p>
          {siteConfig.name}&apos;s services are not intended for children under the age of 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such data, please contact us immediately so we can remove it.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">7. Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time to reflect changes in our practices or for legal reasons. We will post any updates on this page with a new &quot;Effective Date.&quot; We encourage you to review this policy periodically.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">8. Contact Us</h2>
        <p>
          If you have any questions or concerns about this privacy policy, please don&apos;t hesitate to reach out.
        </p>
        <p>
          Email: <a href="mailto:maneelclub@gmail.com" className="text-primary hover:underline">maneelclub@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
