"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { slugify } from "@/lib/format";

// Size guide table (optional, shown on product page)
const sizeChartSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(
    z.object({
      size: z.string(),
      measurements: z.array(z.string()),
    })
  ),
});

/** Optional free-text SEO field: trimmed and length-capped. */
function seoText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable();
}

/**
 * Blank SEO field -> NULL, so "cleared by the admin" and "never set" behave the
 * same and the storefront falls back to the automatic value.
 */
function nz(value: string | null | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

// Schema for product creation/update (WooCommerce-style: Simple vs Variable)
const productSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  regularPrice: z.number().min(0, "Price must be positive"),
  salePrice: z.number().min(0).optional().nullable(),
  categoryId: z.string().optional().nullable(), // Legacy field, kept for backward compatibility
  categoryIds: z.array(z.string()).optional(), // New field for multiple categories
  images: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  stock: z.number().int().min(0).default(0),
  productType: z.enum(["SIMPLE", "VARIABLE"]).default("SIMPLE"),
  trackInventory: z.boolean().default(false), // kept for DB; derived from productType when saving
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sizeChart: sizeChartSchema.optional().nullable(),

  // SEO overrides. An empty field means "use the automatic value", so blanks
  // are stored as NULL rather than as an empty string.
  metaTitle: seoText(70),
  metaDescription: seoText(200),
  canonicalUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(500)
        .url("Canonical URL must be a full URL, e.g. https://maneelclub.com/product/x"),
    ])
    .optional()
    .nullable(),
});

const variantSchema = z.object({
  color: z.string(),
  size: z.string(),
  stock: z.number().int().min(0).default(0),
  price: z.number().min(0).optional().nullable(),
});

// Variant payload keyed by attribute value IDs (for dynamic attributes)
const variantRecordSchema = z.object({
  attributeValueIds: z.array(z.string()).min(1),
  stock: z.number().int().min(0).default(0),
  sku: z.string().optional(),
  price: z.number().min(0).optional().nullable(),
  images: z.array(z.string()).optional(),
});

type ProductInput = z.infer<typeof productSchema>;
type VariantInput = z.infer<typeof variantSchema>;
type VariantRecord = z.infer<typeof variantRecordSchema>;

// Helper to check admin role
async function checkAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required");
  }

  return session.user;
}

// Serialize product for client (Decimal -> number so it can be passed to Client Components)
function serializeProduct<T extends { regularPrice?: unknown; salePrice?: unknown; variants?: Array<{ price?: unknown }> }>(p: T): T {
  return {
    ...p,
    regularPrice: p.regularPrice != null ? Number(p.regularPrice) : 0,
    salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    ...(p.variants && {
      variants: p.variants.map((v) => ({
        ...v,
        price: v.price != null ? Number(v.price) : null,
      })),
    }),
  } as T;
}

// Get all products (admin)
export async function getAdminProducts() {
  try {
    await checkAdmin();

    const products = await db.product.findMany({
      include: {
        category: { include: { parent: true } },
        categories: {
          include: {
            category: {
              include: {
                parent: true,
              },
            },
          },
        },
        variants: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: products.map(serializeProduct) };
  } catch (error) {
    console.error("Error fetching products:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch products" 
    };
  }
}

// Get single product by ID (with variants and attribute values for admin form)
export async function getProductById(id: string) {
  try {
    await checkAdmin();

    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        categories: {
          include: {
            category: true,
          },
        },
        variants: {
          orderBy: { id: "asc" },
          include: {
            attributes: {
              include: {
                attributeValue: { include: { attribute: true } },
              },
            },
          },
        },
        relatedProducts: {
          include: {
            relatedProduct: { select: { id: true, title: true, slug: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    const serialized = serializeProduct(product) as typeof product & {
      variants: Array<{
        id: string;
        productId: string;
        stock: number;
        sku: string | null;
        price: number | null;
        attributes: Array<{
          attributeValue: { id: string; displayValue: string; value: string; metadata?: unknown; attribute: { id: string; slug: string; name: string } };
        }>;
      }>;
    };
    // Derive productType for old rows that might not have it
    (serialized as any).productType = (serialized as { productType?: string }).productType
      ?? (serialized.trackInventory ? "VARIABLE" : "SIMPLE");

    // Add computed color/size and attributeValueIds for admin form
    if (serialized.variants) {
      (serialized as any).variants = serialized.variants.map((v) => {
        const attributeValueIds = v.attributes.map((a) => a.attributeValue.id).sort();
        const color = v.attributes.find((a) => a.attributeValue.attribute.slug === "color")?.attributeValue.displayValue ?? "";
        const size = v.attributes.find((a) => a.attributeValue.attribute.slug === "size")?.attributeValue.displayValue ?? "";
        return {
          ...v,
          attributeValueIds,
          color,
          size,
        };
      });
    }

    return { success: true, data: serialized };
  } catch (error) {
    console.error("Error fetching product:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch product" 
    };
  }
}

/** Admin product search for "You may also like" picker. Returns id, title, slug. Excludes given product and inactive. */
export async function getAdminProductsSearch(query: string, excludeProductId?: string) {
  try {
    await checkAdmin();
    const q = (query || "").trim();
    const products = await db.product.findMany({
      where: {
        isActive: true,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
        ...(q.length > 0
          ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      select: { id: true, title: true, slug: true },
      orderBy: { title: "asc" },
      take: 20,
    });
    return { success: true, data: products };
  } catch (error) {
    console.error("Error searching products:", error);
    return { success: false, error: "Failed to search", data: [] };
  }
}

/** Set manual "You may also like" for a product. Replaces existing list. */
export async function setRelatedProducts(productId: string, relatedProductIds: string[]) {
  try {
    await checkAdmin();

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return { success: false, error: "Product not found" };
    }

    const ids = [...new Set(relatedProductIds)].filter((id) => id && id !== productId);
    if (ids.length !== relatedProductIds.length) {
      return { success: false, error: "Cannot relate a product to itself or use duplicates" };
    }

    const existing = await db.product.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((p) => p.id));
    if (ids.some((id) => !existingIds.has(id))) {
      return { success: false, error: "One or more related product IDs are invalid" };
    }

    await db.$transaction(async (tx) => {
      await tx.productRelatedProduct.deleteMany({ where: { productId } });
      if (ids.length > 0) {
        await tx.productRelatedProduct.createMany({
          data: ids.map((relatedProductId, index) => ({
            productId,
            relatedProductId,
            sortOrder: index,
          })),
        });
      }
    });

    revalidatePath("/admin/products");
    revalidatePath(`/product/${product.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error setting related products:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set related products",
    };
  }
}

// Create product (with optional variants keyed by attribute value IDs; each variant can have its own price)
export async function createProduct(input: ProductInput, variants?: VariantRecord[]) {
  try {
    await checkAdmin();

    const validated = productSchema.parse(input);
    const productType = validated.productType ?? "SIMPLE";
    const trackInventory = productType === "VARIABLE";

    if (productType === "SIMPLE" && variants && variants.length > 0) {
      return { success: false, error: "Simple products cannot have variants. Switch to Variable product type." };
    }
    if (productType === "VARIABLE") {
      if (!variants || variants.length === 0) {
        return { success: false, error: "Variable products require at least one variant. Add attributes and set stock for each combination." };
      }
    }

    const existing = await db.product.findUnique({
      where: { slug: validated.slug },
    });
    if (existing) {
      return { success: false, error: "A product with this slug already exists" };
    }

    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          title: validated.title,
          slug: validated.slug,
          description: validated.description,
          regularPrice: validated.regularPrice,
          salePrice: validated.salePrice,
          // Legacy categoryId is kept in sync with the primary (first) selected category
          // so it can never drift from the many-to-many `categories` source of truth.
          categoryId: validated.categoryIds?.[0] ?? validated.categoryId ?? null,
          images: validated.images,
          colors: validated.colors,
          sizes: validated.sizes,
          stock: validated.stock,
          productType,
          trackInventory,
          isActive: validated.isActive,
          isFeatured: validated.isFeatured,
          metaTitle: nz(validated.metaTitle),
          metaDescription: nz(validated.metaDescription),
          canonicalUrl: nz(validated.canonicalUrl),
          ...(validated.sizeChart &&
            validated.sizeChart.headers.length > 0 &&
            validated.sizeChart.rows.length > 0 && {
              sizeChart: validated.sizeChart as object,
            }),
        } as Parameters<typeof tx.product.create>[0]["data"],
      });

      // Handle multiple categories
      if (validated.categoryIds && validated.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: validated.categoryIds.map((categoryId) => ({
            productId: created.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      if (productType === "VARIABLE" && variants && variants.length > 0) {
        const allValueIds = [...new Set(variants.flatMap((v) => v.attributeValueIds))];
        const attributeValues = await tx.attributeValue.findMany({
          where: { id: { in: allValueIds } },
          include: { attribute: true },
        });
        const valueMap = new Map(attributeValues.map((av) => [av.id, av]));

        const attributeIds = [...new Set(attributeValues.map((av) => av.attributeId))];
        for (const attributeId of attributeIds) {
          await tx.productAttribute.upsert({
            where: {
              productId_attributeId: { productId: created.id, attributeId },
            },
            create: { productId: created.id, attributeId },
            update: {},
          });
        }

        const productAttributes = await tx.productAttribute.findMany({
          where: { productId: created.id },
          include: { selectedValues: true },
        });

        for (const pa of productAttributes) {
          const valueIdsForAttr = attributeValues
            .filter((av) => av.attributeId === pa.attributeId)
            .map((av) => av.id);
          for (const attributeValueId of valueIdsForAttr) {
            await tx.productAttributeValue.upsert({
              where: {
                productAttributeId_attributeValueId: {
                  productAttributeId: pa.id,
                  attributeValueId,
                },
              },
              create: { productAttributeId: pa.id, attributeValueId },
              update: {},
            });
          }
        }

        for (const v of variants) {
          const parsed = variantRecordSchema.safeParse(v);
          if (!parsed.success) continue;
          const { attributeValueIds, stock, sku, price, images } = parsed.data;
          const variant = await tx.productVariant.create({
            data: {
              productId: created.id,
              stock,
              sku: sku || null,
              price: price != null ? price : null,
              images: images ?? [],
            },
          });
          for (const attributeValueId of attributeValueIds) {
            if (!valueMap.has(attributeValueId)) continue;
            await tx.variantAttributeValue.create({
              data: { variantId: variant.id, attributeValueId },
            });
          }
        }
      }

      return tx.product.findUnique({
        where: { id: created.id },
        include: { 
          category: true,
          categories: {
            include: {
              category: true,
            },
          },
          variants: true 
        },
      });
    }, { timeout: 30000 });

    if (!product) {
      return { success: false, error: "Failed to create product" };
    }

    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");

    return { success: true, data: serializeProduct(product) };
  } catch (error) {
    console.error("Error creating product:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create product" 
    };
  }
}

// Update product (optional variants: syncs by deleting existing variants and creating new ones with prices)
export async function updateProduct(id: string, input: Partial<ProductInput>, variants?: VariantRecord[]) {
  try {
    await checkAdmin();

    const product = await db.product.findUnique({ where: { id } });
    if (!product) {
      return { success: false, error: "Product not found" };
    }

    const productType = input.productType ?? (product as { productType?: string }).productType ?? (product.trackInventory ? "VARIABLE" : "SIMPLE");
    const trackInventory = productType === "VARIABLE";

    if (productType === "SIMPLE" && variants && variants.length > 0) {
      return { success: false, error: "Simple products cannot have variants. Switch to Variable product type." };
    }
    if (productType === "VARIABLE" && (!variants || variants.length === 0)) {
      return { success: false, error: "Variable products require at least one variant. Add attributes and set stock for each combination." };
    }

    if (input.slug && input.slug !== product.slug) {
      const existing = await db.product.findUnique({ where: { slug: input.slug } });
      if (existing) {
        return { success: false, error: "A product with this slug already exists" };
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const oldStock = product.stock;
      await tx.product.update({
        where: { id },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.slug && { slug: input.slug }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.regularPrice !== undefined && { regularPrice: input.regularPrice }),
          ...(input.salePrice !== undefined && { salePrice: input.salePrice }),
          // Keep legacy categoryId in sync with the primary (first) selected category.
          // When categoryIds is provided it is the source of truth and overrides any stale categoryId.
          ...(input.categoryIds !== undefined
            ? { categoryId: input.categoryIds[0] ?? null }
            : input.categoryId !== undefined
              ? { categoryId: input.categoryId }
              : {}),
          ...(input.metaTitle !== undefined && { metaTitle: nz(input.metaTitle) }),
          ...(input.metaDescription !== undefined && { metaDescription: nz(input.metaDescription) }),
          ...(input.canonicalUrl !== undefined && { canonicalUrl: nz(input.canonicalUrl) }),
          ...(input.images && { images: input.images }),
          ...(input.colors && { colors: input.colors }),
          ...(input.sizes && { sizes: input.sizes }),
          ...(input.stock !== undefined && { stock: input.stock }),
          productType,
          trackInventory,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
          ...(input.sizeChart !== undefined && {
            sizeChart: input.sizeChart &&
              input.sizeChart.headers.length > 0 &&
              input.sizeChart.rows.length > 0
              ? (input.sizeChart as object)
              : null,
          }),
        } as Parameters<typeof tx.product.update>[0]["data"],
      });

      // Log manual stock change for simple products
      if (productType === "SIMPLE" && input.stock !== undefined) {
        const delta = input.stock - Number(oldStock);
        if (delta !== 0) {
          await tx.stockMovement.create({
            data: {
              productId: id,
              variantId: null,
              delta,
              reason: "MANUAL_EDIT",
            },
          });
        }
      }

      // Handle multiple categories
      if (input.categoryIds !== undefined) {
        // Delete existing category associations
        await tx.productCategory.deleteMany({ where: { productId: id } });
        // Create new associations
        if (input.categoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: input.categoryIds.map((categoryId) => ({
              productId: id,
              categoryId,
            })),
            skipDuplicates: true,
          });
        }
      }

      await tx.productVariant.deleteMany({ where: { productId: id } });

      if (productType === "VARIABLE" && variants && variants.length > 0) {
          const allValueIds = [...new Set(variants.flatMap((v) => v.attributeValueIds))];
          const attributeValues = await tx.attributeValue.findMany({
            where: { id: { in: allValueIds } },
            include: { attribute: true },
          });
          const valueMap = new Map(attributeValues.map((av) => [av.id, av]));

          const attributeIds = [...new Set(attributeValues.map((av) => av.attributeId))];
          for (const attributeId of attributeIds) {
            await tx.productAttribute.upsert({
              where: {
                productId_attributeId: { productId: id, attributeId },
              },
              create: { productId: id, attributeId },
              update: {},
            });
          }

          const productAttributes = await tx.productAttribute.findMany({
            where: { productId: id },
          });

          for (const pa of productAttributes) {
            const valueIdsForAttr = attributeValues
              .filter((av) => av.attributeId === pa.attributeId)
              .map((av) => av.id);
            for (const attributeValueId of valueIdsForAttr) {
              await tx.productAttributeValue.upsert({
                where: {
                  productAttributeId_attributeValueId: {
                    productAttributeId: pa.id,
                    attributeValueId,
                  },
                },
                create: { productAttributeId: pa.id, attributeValueId },
                update: {},
              });
            }
          }

          for (const v of variants) {
            const parsed = variantRecordSchema.safeParse(v);
            if (!parsed.success) continue;
            const { attributeValueIds, stock, sku, price, images } = parsed.data;
            const variant = await tx.productVariant.create({
              data: {
                productId: id,
                stock,
                sku: sku || null,
                price: price != null ? price : null,
                images: images ?? [],
              },
            });
            for (const attributeValueId of attributeValueIds) {
              if (!valueMap.has(attributeValueId)) continue;
              await tx.variantAttributeValue.create({
                data: { variantId: variant.id, attributeValueId },
              });
            }
            if (stock !== 0) {
              await tx.stockMovement.create({
                data: {
                  productId: id,
                  variantId: variant.id,
                  delta: stock,
                  reason: "MANUAL_EDIT",
                },
              });
            }
          }
      }

      return tx.product.findUnique({
        where: { id },
        include: { 
          category: true,
          categories: {
            include: {
              category: true,
            },
          },
          variants: true 
        },
      });
    }, { timeout: 30000 });

    if (!updated) {
      return { success: false, error: "Failed to update product" };
    }

    revalidatePath("/admin/products");
    revalidatePath(`/product/${updated.slug}`);
    revalidatePath("/shop");
    revalidatePath("/");

    return { success: true, data: serializeProduct(updated) };
  } catch (error) {
    console.error("Error updating product:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update product" 
    };
  }
}

// Delete product
export async function deleteProduct(id: string) {
  try {
    await checkAdmin();

    const product = await db.product.findUnique({ where: { id } });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    // Delete variants first, then product
    await db.productVariant.deleteMany({ where: { productId: id } });
    await db.product.delete({ where: { id } });

    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("Error deleting product:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to delete product" 
    };
  }
}

// Toggle product active status
export async function toggleProductStatus(id: string) {
  try {
    await checkAdmin();

    const product = await db.product.findUnique({ where: { id } });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    const updated = await db.product.update({
      where: { id },
      data: { isActive: !product.isActive },
      include: {
        category: true,
        variants: true,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath("/shop");

    return { success: true, data: serializeProduct(updated) };
  } catch (error) {
    console.error("Error toggling product status:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update product" 
    };
  }
}

// Get all categories with hierarchy
export async function getAdminCategories() {
  try {
    await checkAdmin();

    const categories = await db.category.findMany({
      include: {
        parent: true,
        children: {
          include: { _count: { select: { products: true } } },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return { success: true, data: categories };
  } catch (error) {
    console.error("Error fetching categories:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch categories" 
    };
  }
}

// Create category
export async function createCategory(
  name: string,
  slug: string,
  description?: string,
  parentId?: string | null,
  image?: string | null,
  // Optional trailing argument so existing callers keep working unchanged.
  seo?: { metaTitle?: string | null; metaDescription?: string | null; canonicalUrl?: string | null }
) {
  try {
    await checkAdmin();

    // Always normalize the slug to a URL-safe form (lowercase, no spaces/special chars).
    // Falls back to slugifying the name if the provided slug reduces to nothing.
    slug = slugify(slug) || slugify(name);
    if (!slug) {
      return { success: false, error: "Could not generate a valid slug. Please provide a name or slug with letters or numbers." };
    }

    const existing = await db.category.findUnique({ where: { slug } });

    if (existing) {
      return { success: false, error: "A category with this slug already exists" };
    }

    if (parentId) {
      const parent = await db.category.findUnique({
        where: { id: parentId },
        include: { _count: { select: { products: true } } },
      });
      if (!parent) {
        return { success: false, error: "Parent category not found" };
      }
      if (parent._count.products > 0) {
        return {
          success: false,
          error: "Parent category has products. Products must be assigned to subcategories only.",
        };
      }
    }

    const category = await db.category.create({
      data: {
        name,
        slug,
        description,
        parentId: parentId || null,
        ...(image != null && image !== "" && { image }),
        metaTitle: nz(seo?.metaTitle),
        metaDescription: nz(seo?.metaDescription),
        canonicalUrl: nz(seo?.canonicalUrl),
      },
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/categories");
    revalidatePath("/shop");
    revalidatePath("/");

    return { success: true, data: category };
  } catch (error) {
    console.error("Error creating category:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create category" 
    };
  }
}

// Update category
export async function updateCategory(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    parentId?: string | null;
    image?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    canonicalUrl?: string | null;
  }
) {
  try {
    await checkAdmin();

    const category = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } }, children: true },
    });

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    // Normalize the slug to a URL-safe form if one was provided.
    if (data.slug !== undefined) {
      const normalized = slugify(data.slug) || slugify(data.name ?? category.name);
      if (!normalized) {
        return { success: false, error: "Could not generate a valid slug. Please provide a name or slug with letters or numbers." };
      }
      data = { ...data, slug: normalized };
    }

    if (data.parentId) {
      if (data.parentId === id) {
        return { success: false, error: "Category cannot be its own parent" };
      }
      const parent = await db.category.findUnique({
        where: { id: data.parentId },
        include: { _count: { select: { products: true } } },
      });
      if (!parent) {
        return { success: false, error: "Parent category not found" };
      }
      if (parent._count.products > 0) {
        return {
          success: false,
          error: "Parent category has products. Products must be in subcategories only.",
        };
      }
    }

    if (data.slug && data.slug !== category.slug) {
      const existing = await db.category.findUnique({ where: { slug: data.slug } });
      if (existing) {
        return { success: false, error: "A category with this slug already exists" };
      }
    }

    const updated = await db.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.metaTitle !== undefined && { metaTitle: nz(data.metaTitle) }),
        ...(data.metaDescription !== undefined && { metaDescription: nz(data.metaDescription) }),
        ...(data.canonicalUrl !== undefined && { canonicalUrl: nz(data.canonicalUrl) }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.image !== undefined && { image: data.image || null }),
      },
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/categories");
    revalidatePath("/shop");
    revalidatePath("/");

    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating category:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update category" 
    };
  }
}

// Delete category
export async function deleteCategory(id: string) {
  try {
    await checkAdmin();

    const category = await db.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
        children: { include: { _count: { select: { products: true } } } },
      },
    });

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    if (category._count.products > 0) {
      return { 
        success: false, 
        error: "Cannot delete category with products. Remove products first." 
      };
    }

    const hasChildrenWithProducts = category.children?.some(
      (c) => (c._count?.products ?? 0) > 0
    );
    if (hasChildrenWithProducts) {
      return {
        success: false,
        error: "Cannot delete: some subcategories have products. Remove products first.",
      };
    }

    await db.category.delete({ where: { id } });

    revalidatePath("/admin/products");
    revalidatePath("/admin/categories");
    revalidatePath("/shop");

    return { success: true };
  } catch (error) {
    console.error("Error deleting category:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to delete category" 
    };
  }
}
