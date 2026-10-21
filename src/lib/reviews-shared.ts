/**
 * Review / social-proof types and pure helpers. Client-safe: no database access here.
 * Server reads live in lib/reviews.ts; admin writes in actions/admin/reviews.ts.
 */

export const REVIEW_SOURCES = ["MESSENGER", "INSTAGRAM", "FACEBOOK", "WHATSAPP", "PHOTO", "OTHER"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

/** A customer screenshot as the storefront needs it. */
export interface Review {
  id: string;
  image: string;
  width: number;
  height: number;
  /** Not shown on the page; describes the screenshot for screen readers and search engines. */
  caption: string;
  customerName: string;
  /** Star rating 1-5 transcribed from the customer's message; null when unrated. */
  rating: number | null;
  source: ReviewSource;
  /** Home page carousel and product-tab fallback. */
  isFeatured: boolean;
  /** Products this screenshot is about. Empty means a general review. */
  productIds: string[];
}

export const SOURCE_META: Record<ReviewSource, { label: string }> = {
  MESSENGER: { label: "Messenger" },
  INSTAGRAM: { label: "Instagram" },
  FACEBOOK: { label: "Facebook" },
  WHATSAPP: { label: "WhatsApp" },
  PHOTO: { label: "Customer photo" },
  OTHER: { label: "Customer message" },
};

/** Alt text for a screenshot. */
export function reviewAltText(review: Pick<Review, "source" | "customerName" | "caption">): string {
  const who = review.customerName.trim() || "a customer";
  const kind = review.source === "PHOTO" ? "Customer photo" : `${SOURCE_META[review.source].label} message`;
  const caption = review.caption.trim();
  return caption ? `${kind} from ${who}: ${caption}` : `${kind} from ${who}`;
}

/**
 * Screenshots for a product page: ones tagged with the product first, then featured general
 * ones so the tab never looks empty. Input order (admin sort order) is preserved in each group.
 */
/**
 * Average rating and count for one product.
 *
 * `productId` is required and the review must be tagged to it. The list handed
 * in by `pickReviewsForProduct` is padded with featured screenshots from other
 * products, so averaging the whole list would attribute one product's ratings
 * to every product on the site.
 *
 * Only rated reviews count. Returns null when none are rated, so callers emit
 * no AggregateRating rather than a zero or an invented one.
 */
export function aggregateRating(
  reviews: Pick<Review, "rating" | "productIds">[],
  productId: string
): { ratingValue: number; reviewCount: number } | null {
  const rated = reviews.filter(
    (r): r is { rating: number; productIds: string[] } =>
      typeof r.rating === "number" &&
      r.rating >= 1 &&
      r.productIds.includes(productId)
  );
  if (rated.length === 0) return null;

  const total = rated.reduce((sum, r) => sum + r.rating, 0);
  return {
    // One decimal place, as Google displays it.
    ratingValue: Math.round((total / rated.length) * 10) / 10,
    reviewCount: rated.length,
  };
}

export function pickReviewsForProduct(all: Review[], productId: string, limit: number): Review[] {
  const tagged = all.filter((r) => r.productIds.includes(productId));
  const featured = all.filter((r) => r.isFeatured && !r.productIds.includes(productId));
  return [...tagged, ...featured].slice(0, limit);
}

export interface SocialProofSettings {
  customerCount: string;
  ordersDelivered: string;
  homeEnabled: boolean;
  productTabEnabled: boolean;
  trustLineEnabled: boolean;
  /** Home section heading with placeholders already filled in. */
  homeHeading: string;
  /** Home section paragraph with placeholders already filled in. */
  homeDescription: string;
}

export const SOCIAL_PROOF_DEFAULTS = {
  reviewsCustomerCount: "10,000+",
  reviewsOrdersDelivered: "8,800+",
  reviewsHomeEnabled: "true",
  reviewsProductTabEnabled: "true",
  reviewsTrustLineEnabled: "true",
  // Home section text. {customers} and {orders} are replaced with the two numbers above.
  reviewsHomeHeading: "{customers} customers have shopped with us",
  reviewsHomeDescription:
    "{orders} orders delivered, cash on delivery in every district. These are the messages customers send us after their parcel arrives.",
} as const;

/** Replace {customers} and {orders} in admin-written text. Unknown placeholders are left as typed. */
export function fillSocialProofText(
  template: string,
  values: { customers: string; orders: string }
): string {
  return template.replace(/\{\s*(customers|orders)\s*\}/g, (_, key: "customers" | "orders") => values[key]);
}

/** Read the social-proof settings from the raw settings map, falling back to defaults. */
export function buildSocialProofSettings(settings: Record<string, string | undefined>): SocialProofSettings {
  const text = (key: keyof typeof SOCIAL_PROOF_DEFAULTS) =>
    (settings[key] ?? "").trim() || SOCIAL_PROOF_DEFAULTS[key];
  const flag = (key: keyof typeof SOCIAL_PROOF_DEFAULTS) => text(key) !== "false";
  const values = { customers: text("reviewsCustomerCount"), orders: text("reviewsOrdersDelivered") };
  return {
    customerCount: values.customers,
    ordersDelivered: values.orders,
    homeEnabled: flag("reviewsHomeEnabled"),
    productTabEnabled: flag("reviewsProductTabEnabled"),
    trustLineEnabled: flag("reviewsTrustLineEnabled"),
    homeHeading: fillSocialProofText(text("reviewsHomeHeading"), values),
    // Unlike the heading, an emptied description is respected (heading-only section);
    // the default applies only when the setting has never been saved.
    homeDescription: fillSocialProofText(
      (settings.reviewsHomeDescription ?? SOCIAL_PROOF_DEFAULTS.reviewsHomeDescription).trim(),
      values
    ),
  };
}
