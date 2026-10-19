import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Mail, Phone, MapPin, Code } from "lucide-react";
import type { FooterSettings } from "@/lib/settings-defaults";

interface FooterProps {
  /** Footer content from admin settings (General + Footer tabs). */
  settings: FooterSettings;
}

export function Footer({ settings }: FooterProps) {
  const {
    storeName,
    tagline,
    facebookUrl,
    instagramUrl,
    whatsappNumber,
    email,
    phone,
    address,
    mapUrl,
    columns,
    bottomLinks,
  } = settings;
  const whatsappDigits = whatsappNumber.replace(/\D/g, "");
  const whatsappLink = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";
  const hasSocial = Boolean(facebookUrl || instagramUrl || whatsappLink);
  const hasContact = Boolean(phone || email || address.length > 0);
  const currentYear = new Date().getFullYear();

  const addressLines = address.map((line, index) => (
    <span key={index} className="block">
      {line}
    </span>
  ));

  return (
    <footer className="bg-muted/40 border-t">
      <div className="py-12 md:py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand Info */}
            <div className="space-y-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="relative h-10 w-10">
                  <Image
                    src="/logo.png"
                    alt=""
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                </div>
                <span className="font-bold text-xl">{storeName}</span>
              </Link>
              {tagline && (
                <p className="text-sm text-muted-foreground">{tagline}</p>
              )}
              {hasSocial && (
                <div className="flex items-center gap-4">
                  {facebookUrl && (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Facebook"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                  )}
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Instagram"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      aria-label="WhatsApp"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Link Columns (editable in Admin → Settings → Footer) */}
            {columns.map((column, columnIndex) => (
              <div key={columnIndex}>
                <h3 className="font-semibold mb-4">{column.title}</h3>
                <ul className="space-y-2">
                  {column.links.map((link, linkIndex) => (
                    <li key={`${linkIndex}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Contact Info */}
            {hasContact && (
              <div>
                <h3 className="font-semibold mb-4">Contact</h3>
                <ul className="space-y-3">
                  {phone && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <a
                        href={`tel:${phone}`}
                        className="hover:text-primary transition-colors"
                      >
                        {phone}
                      </a>
                    </li>
                  )}
                  {email && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <a
                        href={`mailto:${email}`}
                        className="hover:text-primary transition-colors"
                      >
                        {email}
                      </a>
                    </li>
                  )}
                  {address.length > 0 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {mapUrl ? (
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          {addressLines}
                        </a>
                      ) : (
                        <span>{addressLines}</span>
                      )}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t">
        <div className="container">
          <div className="py-6 space-y-4">
            {/* Copyright and Links */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-muted-foreground">
                &copy; {currentYear} {storeName}. All rights reserved.
              </p>
              {bottomLinks.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {bottomLinks.map((link, index) => (
                    <Link
                      key={`${index}-${link.href}`}
                      href={link.href}
                      className="hover:text-primary transition-colors"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Developer Credit */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5" />
                  <span>Designed &amp; built by</span>
                  <a
                    href="https://arrowbin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    Arrowbin
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
