import { z } from "zod";

/** Cover image: an https URL (ImageKit) or a site-relative upload path. */
const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || v.startsWith("https://") || (v.startsWith("/") && !v.startsWith("//")), {
    message: "Image must be an https URL or a site path",
  });

/** Optional free-text field; blank is stored as NULL so fallbacks apply. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Must be ${max} characters or fewer`).optional().nullable();
}

export const postStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

export const postSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200, "Title is too long"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"),
  excerpt: optionalText(300),
  content: z.string().min(1, "Content is required").max(100_000, "Content is too long"),
  coverImage: imageUrl.optional().nullable(),
  authorName: optionalText(80),
  status: postStatusSchema.default("DRAFT"),

  // SEO overrides; blank falls back to the title/excerpt.
  metaTitle: optionalText(70),
  metaDescription: optionalText(200),
  canonicalUrl: z
    .union([z.literal(""), z.string().trim().max(500).url("Canonical URL must be a full URL")])
    .optional()
    .nullable(),
});

export const updatePostSchema = postSchema.partial();

export type PostInput = z.infer<typeof postSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
