import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { MetaPixelScript, GTMScript } from "@/components/analytics";
import { getMetaPixelSettings, getGtmSettings, getSeoSettings } from "@/lib/settings";
import { siteConfig } from "@/lib/constants";
import { absoluteImageUrl, absoluteUrl, organizationJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

/**
 * Site-level metadata, read from Settings so renaming the store in the admin
 * also renames it in search results. `siteConfig` remains the fallback.
 */
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();

  return {
    title: {
      default: seo.storeName,
      template: `%s | ${seo.storeName}`,
    },
    description: seo.storeDescription,
    keywords: seo.keywords.length
      ? seo.keywords
      : [
          "clothing",
          "fashion",
          "bangladesh",
          "maneel club",
          "t-shirts",
          "hoodies",
          "winter collection",
        ],
    authors: [
      { name: seo.storeName, url: siteConfig.url },
      { name: siteConfig.developer.name, url: siteConfig.developer.url },
    ],
    creator: siteConfig.developer.name,
    publisher: seo.storeName,
    metadataBase: new URL(siteConfig.url),
    openGraph: {
      type: "website",
      locale: "en_US",
      url: absoluteUrl("/"),
      title: seo.storeName,
      description: seo.storeDescription,
      siteName: seo.storeName,
      images: [
        {
          url: absoluteImageUrl(siteConfig.ogImage),
          width: 1200,
          height: 630,
          alt: seo.storeName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.storeName,
      description: seo.storeDescription,
      images: [absoluteImageUrl(siteConfig.ogImage)],
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [metaPixel, gtm, seo] = await Promise.all([
    getMetaPixelSettings(),
    getGtmSettings(),
    getSeoSettings(),
  ]);

  // Structured data (schema.org) so search/answer engines know the site and who built it.
  // The Organization is emitted as its own node and referenced by @id, so product
  // and breadcrumb graphs on other pages can point at the same entity.
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: seo.storeName,
    url: absoluteUrl("/"),
    description: seo.storeDescription,
    inLanguage: "en",
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
    creator: {
      "@type": "Organization",
      name: siteConfig.developer.name,
      url: siteConfig.developer.url,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/shop")}?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <JsonLd data={[organizationJsonLd(seo.storeName, seo.storeDescription), websiteJsonLd]} />
        {/* Initialize dataLayer before GTM/Meta so all tags can read events */}
        <script
          dangerouslySetInnerHTML={{
            __html: "window.dataLayer = window.dataLayer || [];",
          }}
        />
        <GTMScript containerId={gtm.containerId} />
        <MetaPixelScript pixelId={metaPixel.pixelId} enabled={metaPixel.enabled} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
