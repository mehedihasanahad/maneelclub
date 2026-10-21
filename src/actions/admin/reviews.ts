"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createReviewsSchema,
  reorderReviewsSchema,
  updateReviewSchema,
  type CreateReviewInput,
  type UpdateReviewInput,
} from "@/schemas/review";
import type { ReviewSource } from "@/lib/reviews-shared";

async function checkAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required");
  }
  return session.user;
}

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

function fail(error: unknown, fallback: string): { success: false; error: string } {
  console.error(fallback, error);
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return { success: false, error: issues[0]?.message ?? fallback };
  }
  return { success: false, error: error instanceof Error ? error.message : fallback };
}

/** Refresh every page that shows reviews: home, /reviews and product pages share the root layout. */
function revalidateReviews() {
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

export type AdminReview = {
  id: string;
  image: string;
  width: number;
  height: number;
  caption: string;
  customerName: string;
  rating: number | null;
  source: ReviewSource;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  products: Array<{ id: string; title: string }>;
};

export async function getAdminReviews(): Promise<Result<AdminReview[]>> {
  try {
    await checkAdmin();
    const rows = await db.review.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { products: { include: { product: { select: { id: true, title: true } } } } },
    });
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        image: r.image,
        width: r.width,
        height: r.height,
        caption: r.caption,
        customerName: r.customerName,
        rating: r.rating,
        source: r.source,
        isFeatured: r.isFeatured,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
        products: r.products.map((p) => p.product),
      })),
    };
  } catch (error) {
    return fail(error, "Failed to load reviews");
  }
}

/** Save freshly uploaded screenshots at the end of the list, active and not featured. */
export async function createReviews(input: CreateReviewInput[]): Promise<Result<{ count: number }>> {
  try {
    await checkAdmin();
    const items = createReviewsSchema.parse(input);
    const last = await db.review.aggregate({ _max: { sortOrder: true } });
    const start = (last._max.sortOrder ?? -1) + 1;
    await db.review.createMany({
      data: items.map((item, i) => ({ ...item, sortOrder: start + i })),
    });
    revalidateReviews();
    return { success: true, data: { count: items.length } };
  } catch (error) {
    return fail(error, "Failed to save reviews");
  }
}

export async function updateReview(id: string, input: UpdateReviewInput): Promise<Result> {
  try {
    await checkAdmin();
    const { productIds, ...fields } = updateReviewSchema.parse(input);
    await db.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: fields });
      if (productIds) {
        await tx.reviewProduct.deleteMany({ where: { reviewId: id } });
        const unique = [...new Set(productIds)];
        if (unique.length > 0) {
          await tx.reviewProduct.createMany({
            data: unique.map((productId) => ({ reviewId: id, productId })),
            skipDuplicates: true,
          });
        }
      }
    });
    revalidateReviews();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to update review");
  }
}

/** Remove a review from the site. The image file stays in ImageKit. */
export async function deleteReview(id: string): Promise<Result> {
  try {
    await checkAdmin();
    await db.review.delete({ where: { id } });
    revalidateReviews();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to delete review");
  }
}

/** Persist a new display order: position in the array becomes sortOrder. */
export async function reorderReviews(orderedIds: string[]): Promise<Result> {
  try {
    await checkAdmin();
    const ids = reorderReviewsSchema.parse(orderedIds);
    await db.$transaction(
      ids.map((id, index) => db.review.update({ where: { id }, data: { sortOrder: index } }))
    );
    revalidateReviews();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to reorder reviews");
  }
}
