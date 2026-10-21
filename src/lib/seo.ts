import { siteConfig } from "@/lib/constants";

/**
 * SEO helpers: canonical URLs and schema.org structured data.
 *
 * Canonicals are returned as absolute URLs. Next.js would resolve a relative
 * value against `metadataBase`, but product/category pages are also consumed by
 * the JSON-LD builders below, which need absolute URLs either way - keeping one
 * form avoids two notions of "the URL of this page".
 */

/** Absolute URL for a site-relative path, e.g. "/shop" -> "https://host/shop". */
export function absoluteUrl(path: string): string {
  const base = siteConfig.url.replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Absolute URL for an image that may already be absolute (ImageKit/CDN) or
 * site-relative (local uploads, /logo.png).
 */
export function absoluteImageUrl(src: string): string {
  if (!src) return absoluteUrl(siteConfig.ogImage);
  if (/^https?:\/\//i.test(src)) return src;
  return absoluteUrl(src);
}

/** `alternates.canonical` for a page, so filter/sort query strings collapse to one URL. */
export function canonical(path: string) {
  return { canonical: absoluteUrl(path) };
}

/**
 * Open Graph images for a page.
 *
 * Next.js replaces `openGraph` wholesale rather than deep-merging it, so any
 * page that sets its own `openGraph` block loses the root layout's image unless
 * it passes one. Call this to keep the share card working.
 */
export function ogImages(src?: string | null) {
  return [
    {
      url: absoluteImageUrl(src || siteConfig.ogImage),
      width: 1200,
      height: 630,
      alt: siteConfig.name,
    },
  ];
}

// ==================== STRUCTURED DATA ====================

type JsonLdObject = Record<string, unknown>;

/** The organisation behind the store - powers brand/knowledge-panel results. */
export function organizationJsonLd(
  /** Resolved from Settings by the caller; falls back to the build-time values. */
  storeName: string = siteConfig.name,
  storeDescription: string = siteConfig.description
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absoluteUrl("/")}#organization`,
    name: storeName,
    url: absoluteUrl("/"),
    description: storeDescription,
    logo: {
      "@type": "ImageObject",
      url: absoluteImageUrl("/logo.png"),
    },
    image: absoluteImageUrl(siteConfig.ogImage),
    email: siteConfig.email,
    telephone: siteConfig.whatsapp,
    address: {
      "@type": "PostalAddress",
      addressCountry: siteConfig.country,
    },
    sameAs: [siteConfig.facebook, siteConfig.whatsappLink],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: siteConfig.email,
      telephone: siteConfig.whatsapp,
      areaServed: siteConfig.country,
      availableLanguage: ["en", "bn"],
    },
  };
}

/** Visible breadcrumb trails, marked up so search engines show the same path. */
export function breadcrumbJsonLd(
  items: { name: string; path: string }[]
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export interface ProductJsonLdInput {
  title: string;
  slug: string;
  description?: string | null;
  images: string[];
  /** Price shoppers actually pay: sale price when set, otherwise regular price. */
  price: number;
  inStock: boolean;
  categoryName?: string | null;
  /**
   * Star average, built from the same helper that renders the visible summary
   * on the page. Omitted when no tagged review carries a rating - Google
   * requires the markup to match what a visitor can see.
   */
  rating?: { ratingValue: number; reviewCount: number } | null;
  /** Real shipping rates from Settings, so the Offer can state delivery cost. */
  shipping?: { dhaka: number; outside: number; freeOver: number } | null;
}

/**
 * Product + Offer. Deliberately omits `aggregateRating` and `review`: the Review
 * model stores social-proof screenshots with no rating field, so any star value
 * here would be invented - which breaks Google's structured data policy.
 */
export function productJsonLd(product: ProductJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/product/${product.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    url,
    ...(product.description ? { description: product.description } : {}),
    image: product.images.length
      ? product.images.map(absoluteImageUrl)
      : [absoluteImageUrl(siteConfig.ogImage)],
    brand: {
      "@type": "Brand",
      name: siteConfig.name,
    },
    ...(product.categoryName ? { category: product.categoryName } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: siteConfig.currency,
      price: product.price.toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: siteConfig.name,
      },
      ...(product.shipping
        ? { shippingDetails: shippingDetailsJsonLd(product.shipping) }
        : {}),
      hasMerchantReturnPolicy: merchantReturnPolicyJsonLd(),
    },
    ...(product.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.ratingValue,
            reviewCount: product.rating.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/**
 * Delivery cost per zone, taken from the Shipping settings.
 *
 * Only the rate and destination are stated. Delivery *time* is deliberately
 * omitted: the store publishes no guaranteed transit days, and inventing one
 * would put a promise in Google's results that the business has not made.
 */
function shippingDetailsJsonLd(shipping: {
  dhaka: number;
  outside: number;
  freeOver: number;
}): JsonLdObject[] {
  const rate = (value: number, region?: string): JsonLdObject => ({
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: value.toFixed(2),
      currency: siteConfig.currency,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "BD",
      ...(region ? { addressRegion: region } : {}),
    },
  });

  return [
    // Dhaka and the two adjacent districts share the lower rate.
    rate(shipping.dhaka, "Dhaka"),
    rate(shipping.outside),
  ];
}

/**
 * The published Return & Exchange Policy, expressed for search engines.
 *
 * Mirrors /returns exactly: no cash refunds, exchange only, the customer must
 * raise it within 24 hours of delivery and pays return shipping.
 */
function merchantReturnPolicyJsonLd(): JsonLdObject {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "BD",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    // The policy is stated in hours; schema.org only takes whole days.
    merchantReturnDays: 1,
    returnMethod: "https://schema.org/ReturnByMail",
    // "You will be responsible for the shipping costs to send the item back."
    returnFees: "https://schema.org/ReturnShippingFees",
    // Exchanges only - the policy states there are no cash refunds.
    refundType: "https://schema.org/ExchangeRefund",
    merchantReturnLink: absoluteUrl("/returns"),
  };
}

/** Ordered list of products on a listing page. */
export function itemListJsonLd(
  items: { title: string; slug: string }[],
  listName: string
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: absoluteUrl(`/product/${item.slug}`),
    })),
  };
}

/** Question/answer pairs that are visible on the page. */
export function faqJsonLd(
  items: { question: string; answer: string }[]
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
