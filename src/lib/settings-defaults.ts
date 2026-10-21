// Default settings values - shared between client and server
import { SOCIAL_PROOF_DEFAULTS } from "./reviews-shared";

// ---------- Shared link / footer types and typed defaults ----------
// Declared above DEFAULT_SETTINGS because it serialises them.

/** A single navigation link (header menu, footer columns, footer bottom bar). */
export type LinkItem = { name: string; href: string };

/** One footer link column: a heading plus its links. */
export type FooterColumn = { title: string; links: LinkItem[] };

export const DEFAULT_HEADER_MENU: LinkItem[] = [
  { name: "Home", href: "/" },
  { name: "Shop", href: "/shop" },
  { name: "New Arrivals", href: "/product-category/new-arrivals" },
  { name: "Winter Collection", href: "/product-category/winter-collection" },
  { name: "Hoodie", href: "/product-category/hoodie" },
  { name: "Blog", href: "/blog" },
];

export const DEFAULT_FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Shop",
    links: [
      { name: "All Products", href: "/shop" },
      { name: "About Us", href: "/about" },
      { name: "New Arrivals", href: "/product-category/new-arrivals" },
      { name: "Winter Collection", href: "/product-category/winter-collection" },
      { name: "Hoodie", href: "/product-category/hoodie" },
    ],
  },
  {
    title: "Support",
    links: [
      { name: "Contact Us", href: "/contact" },
      { name: "Reviews", href: "/reviews" },
      { name: "Shipping Info", href: "/shipping" },
      { name: "Returns & Exchange", href: "/returns" },
      { name: "FAQ", href: "/faq" },
    ],
  },
];

export const DEFAULT_FOOTER_BOTTOM_LINKS: LinkItem[] = [
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms of Service", href: "/terms" },
];

export const DEFAULT_SETTINGS = {
  // Store Information
  storeName: "Maneel Club",
  storeDescription: "Premium clothing brand in Bangladesh",
  storeEmail: "support@maneelclub.com",
  storePhone: "+8801997193518",

  // SEO. Blank values fall back to the store name/description above, so the
  // storefront always has something sensible without the admin filling these in.
  seoHomeTitle: "",
  seoHomeDescription: "",
  seoShopTitle: "",
  seoShopDescription: "",
  seoKeywords: "",
  
  // Social Links
  facebookUrl: "https://www.facebook.com/maneelclub",
  instagramUrl: "",
  whatsappNumber: "+8801997193518",
  
  // Shipping Rates
  shippingDhaka: "80",
  shippingOutside: "130",
  
  // Payment Merchant Numbers
  bkashNumber: "01854938837",
  nagadNumber: "01854938837",
  rocketNumber: "01854938837",
  
  // Announcements
  announcementEnabled: "true",
  announcementMessage: "Free shipping on orders over BDT 2000!",
  announcementLink: "/shop",
  announcementLinkText: "Shop Now",
  // Countdown timer (offer ends at – creates urgency)
  announcementCountdownEnabled: "false",
  announcementCountdownEnd: "", // ISO date string e.g. 2025-12-31T23:59:00
  announcementCountdownLabel: "Offer ends in",
  
  // Order Settings
  lowStockThreshold: "5",
  freeShippingMinimum: "2000",

  // Order cooldown (anti-spam: same IP cannot order again within X minutes)
  orderCooldownEnabled: "false",
  orderCooldownMinutes: "10",

  // Meta Pixel / Facebook Tracking (configure in Admin → Settings → Tracking)
  metaPixelEnabled: "false",
  metaPixelId: "",
  metaCapiAccessToken: "",

  // Google Tag Manager (container ID, e.g. GTM-52G5CZNB)
  gtmContainerId: "",

  // Header navigation (JSON array of { name, href })
  headerMenu: JSON.stringify(DEFAULT_HEADER_MENU),

  // Footer (Admin → Settings → Footer). Store name, phone, email and socials come from the General tab.
  footerTagline: "Premium clothing brand in Bangladesh. Quality fashion at affordable prices.",
  footerColumns: JSON.stringify(DEFAULT_FOOTER_COLUMNS), // JSON array of { title, links: [{ name, href }] }
  footerAddress:
    "Block #A, Muntaha Tower (Grand Floor)\nBehind Al Baraka Hospital, Model Town\nKeraniganj, Dhaka- 1310", // one line per row
  footerMapUrl: "https://maps.app.goo.gl/eva1uWFvVgVcTaKC9",
  footerBottomLinks: JSON.stringify(DEFAULT_FOOTER_BOTTOM_LINKS), // JSON array of { name, href }

  // Customer reviews / social proof (Admin → Reviews)
  ...SOCIAL_PROOF_DEFAULTS,
} as const;

export type SettingsKey = keyof typeof DEFAULT_SETTINGS;

/** Everything the storefront footer renders. Empty strings and empty arrays mean "hide". */
export type FooterSettings = {
  storeName: string;
  tagline: string;
  facebookUrl: string;
  instagramUrl: string;
  /** Raw number as entered, e.g. "+8801997193518". Strip non-digits for wa.me links. */
  whatsappNumber: string;
  email: string;
  phone: string;
  /** Trimmed non-empty address lines. */
  address: string[];
  mapUrl: string;
  columns: FooterColumn[];
  bottomLinks: LinkItem[];
};

/**
 * Build the footer view model from raw settings. Pure so it can be unit tested; the server wrapper
 * in lib/settings.ts supplies the settings map and the resolved WhatsApp number.
 */
export function buildFooterSettings(
  settings: Record<string, string | undefined>,
  options: { whatsappNumber: string; fallbackStoreName: string }
): FooterSettings {
  const text = (value: string | undefined) => (value ?? "").trim();
  return {
    storeName: text(settings.storeName) || options.fallbackStoreName,
    tagline: text(settings.footerTagline),
    facebookUrl: text(settings.facebookUrl),
    instagramUrl: text(settings.instagramUrl),
    whatsappNumber: text(options.whatsappNumber),
    email: text(settings.storeEmail),
    phone: text(settings.storePhone),
    address: (settings.footerAddress ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    mapUrl: text(settings.footerMapUrl),
    columns: parseFooterColumns(settings.footerColumns, DEFAULT_FOOTER_COLUMNS),
    bottomLinks: parseLinkList(settings.footerBottomLinks, DEFAULT_FOOTER_BOTTOM_LINKS),
  };
}

// ---------- Parsers (pure; safe on client and server) ----------

export function isLinkItem(value: unknown): value is LinkItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as LinkItem).name === "string" &&
    typeof (value as LinkItem).href === "string"
  );
}

/**
 * Parse a JSON link list setting. Missing, blank, unparsable or non-array input returns `fallback`.
 * A valid array returns its valid items, which may be empty, so an admin can genuinely clear a list.
 */
export function parseLinkList(raw: string | null | undefined, fallback: LinkItem[]): LinkItem[] {
  if (!raw?.trim()) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter(isLinkItem).map(({ name, href }) => ({ name, href }));
  } catch {
    return fallback;
  }
}

/**
 * Parse the footer columns JSON setting. Same contract as parseLinkList: keeps columns that have a
 * string title and an array of links, dropping any malformed links inside them.
 */
export function parseFooterColumns(
  raw: string | null | undefined,
  fallback: FooterColumn[]
): FooterColumn[] {
  if (!raw?.trim()) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .filter(
        (column): column is { title: string; links: unknown[] } =>
          typeof column === "object" &&
          column !== null &&
          typeof (column as FooterColumn).title === "string" &&
          Array.isArray((column as FooterColumn).links)
      )
      .map((column) => ({
        title: column.title,
        links: column.links.filter(isLinkItem).map(({ name, href }) => ({ name, href })),
      }));
  } catch {
    return fallback;
  }
}
