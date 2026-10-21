import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin } from "lucide-react";
import { siteConfig } from "@/lib/constants";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Contact ${siteConfig.name} – get in touch for orders, support, or inquiries.`,
  alternates: canonical("/contact"),
};

export default function ContactPage() {
  return (
    <div className="container max-w-2xl py-12 md:py-16">
      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="text-muted-foreground mb-8">
        Have a question or need help? Reach out to us.
      </p>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Phone className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div>
            <p className="font-medium">Phone / WhatsApp</p>
            <a href={`tel:${siteConfig.whatsapp}`} className="text-primary hover:underline">
              {siteConfig.whatsapp}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <Mail className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div>
            <p className="font-medium">Email</p>
            <a href={`mailto:${siteConfig.email}`} className="text-primary hover:underline">
              {siteConfig.email}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div>
            <p className="font-medium">Location</p>
            <p className="text-muted-foreground">{siteConfig.country}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground pt-4">
          You can also message us on our{" "}
          <a href={siteConfig.facebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Facebook page
          </a>.
        </p>
      </div>
      <Button asChild className="mt-8">
        <Link href="/shop">Continue Shopping</Link>
      </Button>
    </div>
  );
}
