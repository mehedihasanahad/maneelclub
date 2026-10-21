import { db } from "@/lib/db";
import { cache } from "react";
import {
  DEFAULT_SETTINGS,
  DEFAULT_HEADER_MENU,
  buildFooterSettings,
  parseLinkList,
  type FooterSettings,
  type LinkItem,
} from "@/lib/settings-defaults";
import { siteConfig } from "@/lib/constants";

export type { FooterSettings };

// Cache the settings fetch to avoid multiple database calls per request
export const getSettings = cache(async (): Promise<Record<string, string>> => {
  try {
    const settings = await db.setting.findMany();
    
    // Merge with defaults
    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    
    return result;
  } catch (error) {
    console.error("Error fetching settings:", error);
    return DEFAULT_SETTINGS as unknown as Record<string, string>;
  }
});

// Get a single setting value with default fallback
export async function getSetting(key: string): Promise<string> {
  const settings = await getSettings();
  return settings[key] ?? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] ?? "";
}

/**
 * Site-level SEO, resolved once from Settings with the build-time constants as
 * the fallback.
 *
 * `siteConfig` stays the fallback rather than the source of truth because it is
 * imported by client components, which cannot read the database. Anything
 * rendered on the server (metadata, structured data) should prefer these.
 */
export async function getSeoSettings(): Promise<{
  storeName: string;
  storeDescription: string;
  homeTitle: string;
  homeDescription: string;
  shopTitle: string;
  shopDescription: string;
  keywords: string[];
}> {
  const settings = await getSettings();

  const storeName = settings.storeName?.trim() || siteConfig.name;
  const storeDescription =
    settings.storeDescription?.trim() || siteConfig.description;

  return {
    storeName,
    storeDescription,
    homeTitle: settings.seoHomeTitle?.trim() || `${storeName} | ${storeDescription}`,
    homeDescription: settings.seoHomeDescription?.trim() || storeDescription,
    shopTitle: settings.seoShopTitle?.trim() || "Shop",
    shopDescription:
      settings.seoShopDescription?.trim() ||
      `Browse all products at ${storeName}. Premium clothing at affordable prices.`,
    keywords: (settings.seoKeywords || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  };
}

// Shipping rates helper
export async function getShippingRates(): Promise<{ dhaka: number; outside: number }> {
  const settings = await getSettings();
  return {
    dhaka: parseInt(settings.shippingDhaka || "80", 10),
    outside: parseInt(settings.shippingOutside || "130", 10),
  };
}

// Dynamic shipping cost based on city (using database settings)
export async function getDynamicShippingCost(city: string): Promise<number> {
  const rates = await getShippingRates();
  
  // Dhaka areas get dhaka rate
  const dhakaAreas = ["dhaka", "gazipur", "narayanganj"];
  if (dhakaAreas.includes(city.toLowerCase())) {
    return rates.dhaka;
  }
  
  return rates.outside;
}

// Get merchant payment numbers
export async function getMerchantNumbers(): Promise<{
  bkash: string;
  nagad: string;
  rocket: string;
}> {
  const settings = await getSettings();
  return {
    bkash: settings.bkashNumber || "01854938837",
    nagad: settings.nagadNumber || "01854938837",
    rocket: settings.rocketNumber || "01854938837",
  };
}

// Get WhatsApp number for contact links (e.g. cooldown message)
export async function getWhatsappNumber(): Promise<string> {
  const settings = await getSettings();
  return settings.whatsappNumber || settings.storePhone || "";
}

// Get announcement settings (including optional countdown)
export async function getAnnouncementSettings(): Promise<{
  enabled: boolean;
  message: string;
  link: string;
  linkText: string;
  countdownEnabled: boolean;
  countdownEnd: string; // ISO date string, empty if not set
  countdownLabel: string;
}> {
  const settings = await getSettings();
  return {
    enabled: settings.announcementEnabled === "true",
    message: settings.announcementMessage || "",
    link: settings.announcementLink || "",
    linkText: settings.announcementLinkText || "",
    countdownEnabled: settings.announcementCountdownEnabled === "true",
    countdownEnd: settings.announcementCountdownEnd || "",
    countdownLabel: settings.announcementCountdownLabel || "Offer ends in",
  };
}

// Get low stock threshold
export async function getLowStockThreshold(): Promise<number> {
  const settings = await getSettings();
  return parseInt(settings.lowStockThreshold || "5", 10);
}

// Get free shipping minimum
export async function getFreeShippingMinimum(): Promise<number> {
  const settings = await getSettings();
  return parseInt(settings.freeShippingMinimum || "2000", 10);
}

// Get order cooldown settings (anti-spam: same IP cannot order again within X minutes)
export async function getOrderCooldownSettings(): Promise<{
  enabled: boolean;
  minutes: number;
}> {
  const settings = await getSettings();
  const minutes = Math.min(
    1440,
    Math.max(1, parseInt(settings.orderCooldownMinutes || "10", 10) || 10)
  );
  return {
    enabled: settings.orderCooldownEnabled === "true",
    minutes,
  };
}

// Get Meta Pixel settings (public: pixel ID + enabled - safe to expose to client)
export async function getMetaPixelSettings(): Promise<{ enabled: boolean; pixelId: string }> {
  const settings = await getSettings();
  return {
    enabled: settings.metaPixelEnabled === "true",
    pixelId: settings.metaPixelId || "",
  };
}

// Get GTM container ID for script injection (public - safe to expose)
export async function getGtmSettings(): Promise<{ containerId: string }> {
  const settings = await getSettings();
  const id = (settings.gtmContainerId || "").trim();
  return {
    containerId: id.startsWith("GTM-") ? id : id ? `GTM-${id}` : "",
  };
}

// Get Meta Conversions API settings (server-only - never expose token to client)
export async function getMetaCapiSettings(): Promise<{ pixelId: string; accessToken: string }> {
  const settings = await getSettings();
  return {
    pixelId: settings.metaPixelId || "",
    accessToken: settings.metaCapiAccessToken || "",
  };
}

export type HeaderNavItem = LinkItem;

// Get header navigation menu (for storefront header). An empty list falls back to the default menu.
export const getHeaderMenu = cache(async (): Promise<HeaderNavItem[]> => {
  const settings = await getSettings();
  const items = parseLinkList(settings.headerMenu, DEFAULT_HEADER_MENU);
  return items.length > 0 ? items : DEFAULT_HEADER_MENU;
});

// Get everything the storefront footer and WhatsApp button need (Admin → Settings → General + Footer)
export const getFooterSettings = cache(async (): Promise<FooterSettings> => {
  const [settings, whatsappNumber] = await Promise.all([getSettings(), getWhatsappNumber()]);
  return buildFooterSettings(settings, {
    whatsappNumber,
    fallbackStoreName: siteConfig.name,
  });
});
