import { z } from "zod";
import { REVIEW_SOURCES } from "@/lib/reviews-shared";

/** Uploaded image URL: an https URL (ImageKit) or a site-relative path such as /reviews/x.jpg. */
const imageUrl = z
  .string()
  .trim()
  .min(1, "Image is required")
  .max(1000)
  .refine((v) => v.startsWith("https://") || (v.startsWith("/") && !v.startsWith("//")), {
    message: "Image must be an https URL or a site path",
  });

const dimension = z.number().int().min(1).max(20000);

export const reviewSourceSchema = z.enum(REVIEW_SOURCES);

export const createReviewSchema = z.object({
  image: imageUrl,
  width: dimension,
  height: dimension,
  source: reviewSourceSchema.default("MESSENGER"),
});

export const createReviewsSchema = z.array(createReviewSchema).min(1).max(100);

/**
 * Star rating transcribed from the customer's message. Nullable so an admin can
 * clear it again, which removes the review from the product's average.
 */
const rating = z.number().int().min(1, "Rating must be 1-5").max(5, "Rating must be 1-5").nullable();

export const updateReviewSchema = z
  .object({
    caption: z.string().trim().max(300),
    customerName: z.string().trim().max(80),
    rating,
    source: reviewSourceSchema,
    isFeatured: z.boolean(),
    isActive: z.boolean(),
    productIds: z.array(z.string().min(1).max(50)).max(50),
  })
  .partial();

export const reorderReviewsSchema = z.array(z.string().min(1).max(50)).min(1).max(2000);

export type CreateReviewInput = z.input<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
