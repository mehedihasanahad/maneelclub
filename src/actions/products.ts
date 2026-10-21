"use server";

import { db } from "@/lib/db";
import type { Product, Category, ProductVariant } from "@/types";

/** Minimal category shape for formatting (name, parent) */
interface CategoryLike {
  name: string;
  slug?: string;
  parent?: { name: string } | null;
}

/** DB category from Prisma (minimal shape for transformCategory and primary category) */
interface DbCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
  parent?: DbCategory | null;
  children?: DbCategory[];
}

/** DB product shape for primary category (legacy category or many-to-many) */
interface DbProductCategorySource {
  categories?: Array<{ category: DbCategory }>;
  category?: DbCategory | null;
}

// Helper to format category name with parent hierarchy (e.g., "Collections > Winter Collection")
function formatCategoryName(category: CategoryLike | DbCategory | null | undefined): string {
  if (!category) return "";
  if (category.parent) {
    return `${category.parent.name} > ${category.name}`;
  }
  return category.name;
}

// Helper to get primary category from product (prioritizes many-to-many categories, falls back to legacy)
function getPrimaryCategory(dbProduct: DbProductCategorySource): { category: DbCategory; categoryName: string; categorySlug: string } | null {
  // Priority 1: Use first category from many-to-many relationship (if exists)
  const categories = dbProduct.categories;
  if (categories && categories.length > 0) {
    const firstCategory = categories[0].category;
    if (firstCategory) {
      return {
        category: firstCategory,
        categoryName: formatCategoryName(firstCategory),
        categorySlug: firstCategory.slug || "",
      };
    }
  }
  
  // Priority 2: Fall back to legacy single category (for backward compatibility)
  if (dbProduct.category) {
    return {
      category: dbProduct.category,
      categoryName: formatCategoryName(dbProduct.category),
      categorySlug: dbProduct.category.slug || "",
    };
  }
  
  return null;
}

/** Variant attribute from Prisma include (metadata can be JsonValue) */
interface DbVariantAttribute {
  attributeValue?: {
    attribute?: { slug?: string };
    displayValue?: string;
    metadata?: { hex?: string } | unknown;
  };
}

/** Variant from Prisma include */
interface DbVariant {
  id: string;
  productId: string;
  attributes?: DbVariantAttribute[];
  stock?: number;
  sku?: string | null;
  price?: unknown;
  images?: string[];
}

/** DB product from Prisma findMany/findUnique (minimal shape for transformProduct) */
interface DbProduct {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  regularPrice?: unknown;
  salePrice?: unknown;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  categoryId?: string | null;
  stock?: number;
  trackInventory?: boolean;
  productType?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  /** Prisma returns JsonValue; we coerce to SizeChart | null in transform */
  sizeChart?: unknown;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  variants?: DbVariant[];
  categories?: Array<{ category: DbCategory }>;
  category?: DbCategory | null;
}

// Helper to transform DB product to frontend format (including variants with price)
function transformProduct(dbProduct: DbProduct): Product {
  let variants: ProductVariant[] | undefined;
  const colorHexMap: Record<string, string> = {};

  if (dbProduct.variants?.length) {
    const withAttrs = dbProduct.variants.some((v: DbVariant) => v.attributes?.length);
    if (withAttrs) {
      for (const v of dbProduct.variants) {
        const colorAttr = v.attributes?.find((a: DbVariantAttribute) => a.attributeValue?.attribute?.slug === "color");
        if (colorAttr?.attributeValue) {
          const name = colorAttr.attributeValue.displayValue;
          const meta = colorAttr.attributeValue.metadata as { hex?: string } | null | undefined;
          const hex = meta && typeof meta === "object" && "hex" in meta ? meta.hex : undefined;
          if (name && hex) colorHexMap[name] = String(hex);
        }
      }
      variants = dbProduct.variants.map((v: DbVariant) => {
        const color = v.attributes?.find((a: DbVariantAttribute) => a.attributeValue?.attribute?.slug === "color")?.attributeValue?.displayValue ?? "";
        const size = v.attributes?.find((a: DbVariantAttribute) => a.attributeValue?.attribute?.slug === "size")?.attributeValue?.displayValue ?? "";
        return {
          id: v.id,
          productId: v.productId,
          color,
          size,
          stock: v.stock ?? 0,
          sku: v.sku ?? null,
          price: v.price != null ? Number(v.price.toString()) : null,
          images: v.images ?? [],
        };
      });
    } else {
      variants = dbProduct.variants.map((v: DbVariant) => ({
        id: v.id,
        productId: v.productId,
        color: "",
        size: "",
        stock: v.stock ?? 0,
        sku: v.sku ?? null,
        price: v.price != null ? Number(v.price.toString()) : null,
        images: v.images ?? [],
      }));
    }
  }

  // Intelligently get primary category (handles both legacy and many-to-many relationships)
  const primaryCategory = getPrimaryCategory(dbProduct);

  // All category slugs this product belongs to (many-to-many + legacy fallback),
  // so shop-page filtering matches the same products as the category archive page.
  const categorySlugs = [
    ...new Set(
      [
        ...(dbProduct.categories?.map((c) => c.category?.slug) ?? []),
        dbProduct.category?.slug,
      ].filter((s): s is string => Boolean(s))
    ),
  ];

  return {
    id: dbProduct.id,
    title: dbProduct.title,
    slug: dbProduct.slug,
    description: dbProduct.description || "",
    regularPrice: Number(dbProduct.regularPrice?.toString() || 0),
    salePrice: dbProduct.salePrice ? Number(dbProduct.salePrice.toString()) : null,
    image: dbProduct.images?.[0] || "/productImage.jpeg",
    images: dbProduct.images || ["/productImage.jpeg"],
    colors: dbProduct.colors || [],
    sizes: dbProduct.sizes || [],
    categoryId: dbProduct.categoryId || "",
    categorySlug: primaryCategory?.categorySlug || "",
    categorySlugs,
    categoryName: primaryCategory?.categoryName || "",
    category: primaryCategory?.category ? transformCategory(primaryCategory.category, true) : null,
    stock: dbProduct.stock ?? 0,
    trackInventory: dbProduct.trackInventory ?? false,
    productType: (dbProduct.productType ?? (dbProduct.trackInventory ? "VARIABLE" : "SIMPLE")) as Product["productType"],
    isActive: dbProduct.isActive ?? true,
    isFeatured: dbProduct.isFeatured ?? false,
    sizeChart: (dbProduct.sizeChart ?? null) as Product["sizeChart"],
    metaTitle: dbProduct.metaTitle ?? null,
    metaDescription: dbProduct.metaDescription ?? null,
    canonicalUrl: dbProduct.canonicalUrl ?? null,
    variants,
    colorHexMap: Object.keys(colorHexMap).length > 0 ? colorHexMap : undefined,
    createdAt: dbProduct.createdAt,
    updatedAt: dbProduct.updatedAt,
  };
}

function transformCategory(dbCategory: DbCategory, shallow = false): Category {
  const base = {
    id: dbCategory.id,
    name: dbCategory.name,
    slug: dbCategory.slug,
    description: dbCategory.description || "",
    image: dbCategory.image || "/logo.png",
    parentId: dbCategory.parentId ?? null,
    metaTitle: dbCategory.metaTitle ?? null,
    metaDescription: dbCategory.metaDescription ?? null,
    canonicalUrl: dbCategory.canonicalUrl ?? null,
    isActive: dbCategory.isActive ?? true,
    sortOrder: dbCategory.sortOrder ?? 0,
    createdAt: dbCategory.createdAt,
    updatedAt: dbCategory.updatedAt,
  };
  if (shallow) return base as Category;
  return {
    ...base,
    parent: dbCategory.parent
      ? transformCategory(dbCategory.parent, true)
      : null,
    children: dbCategory.children?.map((c: DbCategory) => transformCategory(c)),
  } as Category;
}

/**
 * Get featured products for homepage
 */
export async function getFeaturedProducts(limit = 4) {
  try {
    const products = await db.product.findMany({
      where: { isFeatured: true, isActive: true },
      include: { 
        category: {
          include: { parent: true },
        },
        categories: {
          include: {
            category: {
              include: { parent: true },
            },
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    
    return { success: true, data: products.map(transformProduct) };
  } catch (error) {
    console.error("Error fetching featured products:", error);
    return { success: false, error: "Failed to fetch products", data: [] };
  }
}

/**
 * Get new arrivals for homepage
 */
export async function getNewArrivals(limit = 4) {
  try {
    const products = await db.product.findMany({
      where: { isActive: true },
      include: { 
        category: {
          include: { parent: true },
        },
        categories: {
          include: {
            category: {
              include: { parent: true },
            },
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    
    return { success: true, data: products.map(transformProduct) };
  } catch (error) {
    console.error("Error fetching new arrivals:", error);
    return { success: false, error: "Failed to fetch products", data: [] };
  }
}

/**
 * Get products by category slug (supports parent slugs: returns products from all child categories)
 */
export async function getProductsByCategory(categorySlug: string) {
  try {
    if (categorySlug === "all") {
      const products = await db.product.findMany({
        where: { isActive: true },
        include: { 
          category: {
            include: { parent: true },
          },
          categories: {
            include: {
              category: {
                include: { parent: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return { success: true, data: products.map(transformProduct) };
    }

    const category = await db.category.findUnique({
      where: { slug: categorySlug },
      include: { children: { select: { id: true } } },
    });

    if (!category) {
      return { success: true, data: [] };
    }

    // If it's a subcategory, search for products in that category
    // If it's a parent category, search for products in that category AND its children
    const categoryIds: string[] = category.parentId
      ? [category.id] // Subcategory: search only this category
      : [category.id, ...(category.children?.map((c) => c.id) ?? [])]; // Parent: search this category + children

    if (categoryIds.length === 0) {
      return { success: true, data: [] };
    }

    // Match products via the ProductCategory (many-to-many) relationship — the single
    // source of truth for a product's categories. The legacy `categoryId` is kept in
    // sync with the primary category on write, so it is intentionally not queried here.
    const products = await db.product.findMany({
      where: {
        isActive: true,
        categories: { some: { categoryId: { in: categoryIds } } },
      },
      include: { 
        category: true,
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: products.map(transformProduct) };
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return { success: false, error: "Failed to fetch products", data: [] };
  }
}

/**
 * Resolve color names to hex from Color attribute values in DB (single source of truth).
 */
async function getColorHexMapFromDb(colorNames: string[]): Promise<Record<string, string>> {
  if (colorNames.length === 0) return {};
  const normalized = [...new Set(colorNames.map((n) => n.trim()).filter(Boolean))];
  const values = await db.attributeValue.findMany({
    where: {
      attribute: { slug: "color" },
      OR: [
        { displayValue: { in: normalized } },
        { value: { in: normalized } },
      ],
    },
    select: { displayValue: true, value: true, metadata: true },
  });
  const map: Record<string, string> = {};
  for (const v of values) {
    const hex = (v.metadata as { hex?: string } | null)?.hex;
    if (hex) {
      map[v.displayValue] = hex;
      if (v.value !== v.displayValue) map[v.value] = hex;
    }
  }
  return map;
}

/**
 * Get all Color attribute values from DB as the single source of truth for storefront.
 * Returns { value, label, hex } so any color added in admin shows everywhere without editing constants.
 */
export async function getColorOptionsFromDb(): Promise<{ value: string; label: string; hex: string }[]> {
  const values = await db.attributeValue.findMany({
    where: { attribute: { slug: "color" } },
    orderBy: { sortOrder: "asc" },
    select: { value: true, displayValue: true, metadata: true },
  });
  return values
    .map((v) => {
      const hex = (v.metadata as { hex?: string } | null)?.hex ?? "#888888";
      return { value: v.value, label: v.displayValue, hex };
    })
    .filter((c) => c.value && c.label);
}

/**
 * Get single product by slug (with variants and attribute values for storefront pricing).
 * Color hex is resolved from DB (Color attribute values with metadata.hex) so any admin-added color shows correctly.
 */
export async function getProductBySlug(slug: string) {
  try {
    const product = await db.product.findUnique({
      where: { slug },
      include: {
        category: {
          include: { parent: true },
        },
        categories: {
          include: {
            category: {
              include: { parent: true },
            },
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
      },
    });

    if (!product || !product.isActive) {
      return { success: false, error: "Product not found", data: null };
    }

    const data = transformProduct(product);

    // Permanent fix: resolve hex for any product color not yet in colorHexMap (from DB Color attribute values)
    const colorNames = [...new Set([...(data.colors || []), ...Object.keys(data.colorHexMap || {})])];
    const missing = colorNames.filter((name) => !data.colorHexMap?.[name]);
    if (missing.length > 0) {
      const dbHexMap = await getColorHexMapFromDb(missing);
      data.colorHexMap = { ...(data.colorHexMap || {}), ...dbHexMap };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching product:", error);
    return { success: false, error: "Failed to fetch product", data: null };
  }
}

/**
 * Get all products (for shop page)
 */
export async function getAllProducts() {
  try {
    const products = await db.product.findMany({
      where: { isActive: true },
      include: { 
        category: true,
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    
    return { success: true, data: products.map(transformProduct) };
  } catch (error) {
    console.error("Error fetching all products:", error);
    return { success: false, error: "Failed to fetch products", data: [] };
  }
}

/**
 * Get all categories with hierarchy (parents with children)
 * Returns flat list; parents have children populated. Orphans (subcategories whose parent is inactive) included.
 */
export async function getCategories() {
  try {
    const categories = await db.category.findMany({
      where: { isActive: true },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return { success: true, data: categories.map((c) => transformCategory(c)) };
  } catch (error) {
    console.error("Error fetching categories:", error);
    return { success: false, error: "Failed to fetch categories", data: [] };
  }
}

/**
 * Get featured categories for homepage (top-level categories with images)
 */
export async function getFeaturedCategories(limit = 4) {
  try {
    const categories = await db.category.findMany({
      where: { 
        isActive: true,
        parentId: null, // Top-level categories only
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: limit,
    });

    return { 
      success: true, 
      data: categories.map((c) => transformCategory(c, true)) 
    };
  } catch (error) {
    console.error("Error fetching featured categories:", error);
    return { success: false, error: "Failed to fetch categories", data: [] };
  }
}

/**
 * Get related products: manual list first (from ProductRelatedProduct), then fill with same-category products up to limit.
 */
export async function getRelatedProducts(productId: string, categoryId?: string | null, limit = 4) {
  try {
    const manualRows = await db.productRelatedProduct.findMany({
      where: { productId },
      include: {
        relatedProduct: {
          include: {
            category: true,
            categories: { include: { category: true } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
      take: limit,
    });

    const manual = manualRows
      .map((r) => r.relatedProduct)
      .filter((p): p is NonNullable<typeof p> => p != null && p.isActive)
      .map((p) => transformProduct(p));
    const manualIds = new Set(manual.map((p) => p.id));

    if (manual.length >= limit) {
      return { success: true, data: manual.slice(0, limit) };
    }

    const need = limit - manual.length;
    const excludeIds = [productId, ...manualIds];
    let fill: Awaited<ReturnType<typeof db.product.findMany>> = [];

    if (need > 0 && categoryId != null && categoryId !== "") {
      fill = await db.product.findMany({
        where: {
          id: { notIn: excludeIds },
          isActive: true,
          OR: [
            { categoryId },
            { categories: { some: { categoryId } } },
          ],
        },
        include: {
          category: true,
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: "desc" },
        take: need,
      });
    }

    const combined = [...manual, ...fill.map((p) => transformProduct(p))];
    return { success: true, data: combined.slice(0, limit) };
  } catch (error) {
    console.error("Error fetching related products:", error);
    return { success: false, error: "Failed to fetch products", data: [] };
  }
}

/**
 * Search products
 */
export async function searchProducts(query: string) {
  try {
    const products = await db.product.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { 
        category: {
          include: { parent: true },
        },
        categories: {
          include: {
            category: {
              include: { parent: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    
    return { success: true, data: products.map(transformProduct) };
  } catch (error) {
    console.error("Error searching products:", error);
    return { success: false, error: "Failed to search products", data: [] };
  }
}
