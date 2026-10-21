import { cache } from "react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  buildSocialProofSettings,
  pickReviewsForProduct,
  type Review,
  type SocialProofSettings,
} from "@/lib/reviews-shared";

export type { Review, SocialProofSettings };

/**
 * Active reviews in admin order, featured flag and product tags included. Cached per request.
 * If the table does not exist yet (code deployed before the migration) this logs and returns [],
 * and every storefront placement hides itself.
 */
export const getActiveReviews = cache(async (): Promise<Review[]> => {
  try {
    const rows = await db.review.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        image: true,
        width: true,
        height: true,
        caption: true,
        customerName: true,
        rating: true,
        source: true,
        isFeatured: true,
        products: { select: { productId: true } },
      },
    });
    return rows.map(({ products, ...r }) => ({ ...r, productIds: products.map((p) => p.productId) }));
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
});

/** Home page: featured screenshots first, then the rest. */
export async function getHomeReviews(): Promise<Review[]> {
  const all = await getActiveReviews();
  return [...all.filter((r) => r.isFeatured), ...all.filter((r) => !r.isFeatured)];
}

/** Product Reviews tab: tagged screenshots first, then featured ones. */
export async function getReviewsForProduct(productId: string, limit = 10): Promise<Review[]> {
  return pickReviewsForProduct(await getActiveReviews(), productId, limit);
}

export const getSocialProofSettings = cache(async (): Promise<SocialProofSettings> => {
  return buildSocialProofSettings(await getSettings());
});
