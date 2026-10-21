"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Save, Package, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { getProductById, updateProduct, getAdminCategories, getAdminProductsSearch, setRelatedProducts } from "@/actions/admin/products";
import { sortSizes } from "@/lib/format";
import { AttributeSelector, ImageUploader, VariantMatrix, SizeGuideEditor, SeoFields } from "@/components/admin";
import type { SizeChartValue } from "@/components/admin/size-guide-editor";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

const productSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  regularPrice: z.coerce.number().min(0, "Price must be positive"),
  salePrice: z.coerce.number().min(0).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  productType: z.enum(["SIMPLE", "VARIABLE"]).default("SIMPLE"),
  // SEO overrides - all optional, blank means "use the automatic value".
  metaTitle: z.string().max(70, "Keep it under 70 characters").optional(),
  metaDescription: z.string().max(200, "Keep it under 200 characters").optional(),
  canonicalUrl: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  parent?: { name: string } | null;
}

interface SelectedValue {
  id: string;
  value: string;
  displayValue: string;
  metadata?: { hex?: string } | null;
}

interface SelectedAttribute {
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
  values: SelectedValue[];
}

interface VariantStock {
  [key: string]: {
    stock: number;
    sku?: string;
    price?: number;
    images?: string[];
  };
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  
  // Attribute and variant state
  const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttribute[]>([]);
  const [variantStocks, setVariantStocks] = useState<VariantStock>({});
  const [sizeChart, setSizeChart] = useState<SizeChartValue | null>(null);

  const [relatedProductIds, setRelatedProductIds] = useState<string[]>([]);
  const [relatedProductTitles, setRelatedProductTitles] = useState<Record<string, string>>({});
  const [relatedSearchQuery, setRelatedSearchQuery] = useState("");
  const [relatedSearchResults, setRelatedSearchResults] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [relatedSearching, setRelatedSearching] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormData>,
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      regularPrice: 0,
      salePrice: null,
      categoryId: null,
      isActive: true,
      isFeatured: false,
      productType: "SIMPLE",
      metaTitle: "",
      metaDescription: "",
      canonicalUrl: "",
    },
  });

  const productType = form.watch("productType");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [productResult, categoriesResult] = await Promise.all([
          getProductById(id),
          getAdminCategories(),
        ]);

        if (!productResult.success || !productResult.data) {
          toast.error("Product not found");
          router.push("/admin/products");
          return;
        }

        const product = productResult.data;
        
        // Convert Prisma Decimal to number for form
        const regularPrice = typeof product.regularPrice === 'object' 
          ? Number(product.regularPrice.toString()) 
          : Number(product.regularPrice);
        const salePrice = product.salePrice 
          ? (typeof product.salePrice === 'object' 
              ? Number(product.salePrice.toString()) 
              : Number(product.salePrice))
          : null;
        
        const productTypeFromDb: "SIMPLE" | "VARIABLE" =
          ((product as { productType?: string }).productType as "SIMPLE" | "VARIABLE" | undefined)
          ?? (product.trackInventory ? "VARIABLE" : "SIMPLE");

        form.reset({
          title: product.title,
          slug: product.slug,
          description: product.description || "",
          regularPrice,
          salePrice,
          categoryId: product.categoryId,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          productType: productTypeFromDb,
          // Empty string, not null, so the inputs stay controlled.
          metaTitle: product.metaTitle ?? "",
          metaDescription: product.metaDescription ?? "",
          canonicalUrl: product.canonicalUrl ?? "",
        });
        
        setImages(product.images?.length ? product.images : []);

        // Load selected categories from ProductCategory relationship
        const productCategories = (product as { categories?: Array<{ categoryId: string }> }).categories || [];
        setSelectedCategoryIds(productCategories.map((pc) => pc.categoryId));

        const existingSizeChart = (product as { sizeChart?: SizeChartValue | null }).sizeChart;
        setSizeChart(
          existingSizeChart &&
            Array.isArray(existingSizeChart.headers) &&
            Array.isArray(existingSizeChart.rows)
            ? existingSizeChart
            : null
        );

        const p = product as unknown as {
          colors?: string[];
          sizes?: string[];
          variants?: Array<{
            attributeValueIds?: string[];
            stock: number;
            sku: string | null;
            price: number | null;
            images?: string[];
            attributes?: Array<{
              attributeValue: { id: string; displayValue: string; value: string; metadata?: { hex?: string } | null; attribute: { id: string; slug: string; name: string } };
            }>;
          }>;
        };

        let attrs: SelectedAttribute[] = [];
        const stocks: VariantStock = {};

        if (p.variants && p.variants.length > 0) {
          const attrMap = new Map<string, SelectedAttribute>();
          for (const v of p.variants) {
            // Key must match VariantMatrix order (attributes by slug, e.g. color then size)
            const key = [...(v.attributes || [])]
              .sort((a, b) => a.attributeValue.attribute.slug.localeCompare(b.attributeValue.attribute.slug))
              .map((a) => a.attributeValue.id)
              .join("-");
            stocks[key] = {
              stock: v.stock,
              sku: v.sku ?? undefined,
              price: v.price != null ? Number(v.price) : undefined,
              images: (v as { images?: string[] }).images ?? [],
            };
            for (const a of v.attributes || []) {
              const attr = a.attributeValue.attribute;
              const val = a.attributeValue;
              if (!attrMap.has(attr.id)) {
                attrMap.set(attr.id, {
                  attributeId: attr.id,
                  attributeName: attr.name,
                  attributeSlug: attr.slug,
                  values: [],
                });
              }
              const entry = attrMap.get(attr.id)!;
              if (!entry.values.some((x) => x.id === val.id)) {
                entry.values.push({
                  id: val.id,
                  value: val.value,
                  displayValue: val.displayValue,
                  metadata: val.metadata as { hex?: string } | null | undefined,
                });
              }
            }
          }
          attrs = Array.from(attrMap.values()).sort((a, b) => a.attributeSlug.localeCompare(b.attributeSlug));
          // Sort each attribute's values for stable display (size: numeric/S-M-L, color: alphabetical)
          for (const attr of attrs) {
            if (attr.attributeSlug === "size") {
              attr.values.sort((a, b) => {
                if (a.displayValue === b.displayValue) return 0;
                const order = sortSizes([a.displayValue, b.displayValue]);
                return order[0] === a.displayValue ? -1 : 1;
              });
            } else {
              attr.values.sort((a, b) => a.displayValue.localeCompare(b.displayValue));
            }
          }
        }

        if (attrs.length === 0 && (product.colors?.length || product.sizes?.length)) {
          if (product.colors && product.colors.length > 0) {
            attrs.push({
              attributeId: "color",
              attributeName: "Color",
              attributeSlug: "color",
              values: product.colors.map((c: string) => ({
                id: c.toLowerCase().replace(/\s+/g, "-"),
                value: c.toLowerCase().replace(/\s+/g, "-"),
                displayValue: c,
              })),
            });
          }
          if (product.sizes && product.sizes.length > 0) {
            attrs.push({
              attributeId: "size",
              attributeName: "Size",
              attributeSlug: "size",
              values: sortSizes(product.sizes).map((s: string) => ({
                id: s.toLowerCase(),
                value: s.toLowerCase(),
                displayValue: s,
              })),
            });
          }
        }

        setSelectedAttributes(attrs);
        setVariantStocks(stocks);

        const related = (product as { relatedProducts?: Array<{ relatedProduct: { id: string; title: string; slug: string } }> }).relatedProducts ?? [];
        setRelatedProductIds(related.map((r) => r.relatedProduct.id));
        setRelatedProductTitles(
          related.reduce((acc, r) => ({ ...acc, [r.relatedProduct.id]: r.relatedProduct.title }), {} as Record<string, string>)
        );

        if (categoriesResult.success) {
          setCategories(categoriesResult.data as Category[]);
        }
      } catch (error) {
        toast.error("Failed to load product");
        router.push("/admin/products");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, router, form]);

  // Debounced search for related products
  useEffect(() => {
    if (!relatedSearchQuery.trim()) {
      setRelatedSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setRelatedSearching(true);
      const res = await getAdminProductsSearch(relatedSearchQuery.trim(), id);
      setRelatedSearching(false);
      if (res.success && res.data) {
        const exclude = new Set([id, ...relatedProductIds]);
        setRelatedSearchResults(res.data.filter((p) => !exclude.has(p.id)));
      } else {
        setRelatedSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [relatedSearchQuery, id, relatedProductIds]);

  // Stable callback for variant stocks
  const handleVariantStocksChange = useCallback((stocks: VariantStock) => {
    setVariantStocks(stocks);
  }, []);

  async function onSubmit(data: ProductFormData) {
    if (data.productType === "VARIABLE") {
      const attributesWithValues = selectedAttributes.filter((a) => a.values.length > 0);
      if (attributesWithValues.length === 0) {
        toast.error("Variable products require at least one attribute (e.g., Color, Size) with values selected.");
        return;
      }
      const variantCount = Object.keys(variantStocks).length;
      if (variantCount === 0) {
        toast.error("Variable products require at least one variant. Select attribute values above to generate the variant matrix.");
        return;
      }
    }

    setSaving(true);
    try {
      const isVariable = data.productType === "VARIABLE";
      const variantsData = isVariable
        ? Object.entries(variantStocks).map(([key, stockData]) => ({
            attributeValueIds: key.split("-"),
            stock: stockData.stock,
            sku: stockData.sku,
            price: stockData.price != null && stockData.price > 0 ? stockData.price : undefined,
            images: stockData.images && stockData.images.length > 0 ? stockData.images : undefined,
          }))
        : undefined;

      const result = await updateProduct(
        id,
        {
          ...data,
          trackInventory: isVariable,
          images: images.length > 0 ? images : ["/productImage.jpeg"],
          colors: selectedAttributes
            .find((a) => a.attributeSlug === "color")
            ?.values.map((v) => v.displayValue) || [],
          sizes: selectedAttributes
            .find((a) => a.attributeSlug === "size")
            ?.values.map((v) => v.displayValue) || [],
          stock: isVariable
            ? Object.values(variantStocks).reduce((sum, v) => sum + (v?.stock ?? 0), 0)
            : 999,
          sizeChart: sizeChart?.headers?.length && sizeChart?.rows?.length ? sizeChart : null,
          categoryIds: selectedCategoryIds,
        },
        variantsData
      );

      if (result.success) {
        const relatedResult = await setRelatedProducts(id, relatedProductIds);
        if (relatedResult.success) {
          toast.success("Product updated successfully");
          router.push("/admin/products");
        } else {
          toast.error(relatedResult.error || "Product saved but related products failed to update");
        }
      } else {
        toast.error(result.error || "Failed to update product");
      }
    } catch (error) {
      toast.error("Failed to update product");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-20 rounded-md" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">
            Update product details
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter product title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug *</FormLabel>
                        <FormControl>
                          <Input placeholder="product-slug" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL-friendly version of the title
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter product description..."
                            rows={5}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Product Type</CardTitle>
                  <CardDescription>
                    Choose how this product is sold (WooCommerce-style)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex flex-col gap-4">
                            <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                              <input
                                type="radio"
                                name={field.name}
                                value="SIMPLE"
                                checked={field.value === "SIMPLE"}
                                onChange={() => field.onChange("SIMPLE")}
                                className="mt-1"
                              />
                              <div>
                                <p className="font-medium">Simple product</p>
                                <p className="text-sm text-muted-foreground">
                                  Single price and stock. You can add attributes for display (e.g. color, size) but they won&apos;t create separate variants.
                                </p>
                              </div>
                            </label>
                            <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                              <input
                                type="radio"
                                name={field.name}
                                value="VARIABLE"
                                checked={field.value === "VARIABLE"}
                                onChange={() => field.onChange("VARIABLE")}
                                className="mt-1"
                              />
                              <div>
                                <p className="font-medium">Variable product</p>
                                <p className="text-sm text-muted-foreground">
                                  Each combination of attributes (e.g. Color + Size) will be a variant with its own stock and optional price/SKU.
                                </p>
                              </div>
                            </label>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="regularPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Regular Price (BDT) *</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="salePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Price (BDT)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Leave empty for no discount"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Product Attributes</CardTitle>
                  <CardDescription>
                    {productType === "SIMPLE"
                      ? "Optional. Add color, size, etc. for display and filtering (no separate variants)."
                      : "Select attributes and values to generate variants (each combination = one variant)."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AttributeSelector
                    selectedAttributes={selectedAttributes}
                    onAttributesChange={setSelectedAttributes}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Inventory
                  </CardTitle>
                  <CardDescription>
                    {productType === "VARIABLE"
                      ? "Set stock (and optional price/SKU) for each variant"
                      : "Simple product: single stock and price"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {productType === "VARIABLE" ? (
                    selectedAttributes.some((a) => a.values.length > 0) ? (
                      <VariantMatrix
                        selectedAttributes={selectedAttributes}
                        variantStocks={variantStocks}
                        onVariantStocksChange={handleVariantStocksChange}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p>Select attribute values above to generate variants</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p>Simple product: single stock and price.</p>
                      <p className="text-sm mt-1">
                        Add optional attributes above for display only.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Images</CardTitle>
                  <CardDescription>
                    Upload product images or use the default placeholder. Drag images to reorder them. The first image will be used as the product thumbnail on product cards and listings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageUploader images={images} onChange={setImages} maxImages={10} />
                </CardContent>
              </Card>

              <SizeGuideEditor value={sizeChart} onChange={setSizeChart} />

              <SeoFields
                control={form.control}
                names={{
                  metaTitle: "metaTitle",
                  metaDescription: "metaDescription",
                  canonicalUrl: "canonicalUrl",
                }}
                autoTitle={form.watch("title") || "Product title"}
                autoDescription={
                  form.watch("description") ||
                  `Buy ${form.watch("title") || "this product"} at Maneel Club`
                }
                canonicalExample={`https://maneelclub.com/product/${form.watch("slug") || "product-slug"}`}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Active</FormLabel>
                          <FormDescription>
                            Product visible in store
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Featured</FormLabel>
                          <FormDescription>
                            Show on homepage
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                  <CardDescription>
                    Select one or more categories/subcategories for this product
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {categories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No categories available</p>
                    ) : (
                      categories.map((category) => (
                        <div key={category.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`cat-${category.id}`}
                            checked={selectedCategoryIds.includes(category.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCategoryIds([...selectedCategoryIds, category.id]);
                              } else {
                                setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== category.id));
                              }
                            }}
                          />
                          <Label
                            htmlFor={`cat-${category.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {category.parent
                              ? `${category.parent.name} › ${category.name}`
                              : category.name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedCategoryIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? "y" : "ies"} selected
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>You may also like</CardTitle>
                  <CardDescription>
                    Products to show in the &quot;You may also like&quot; section on the product page. Order matters. Leave empty to use automatic (same category). First 4 are shown on the storefront.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {relatedProductIds.length > 0 && (
                    <ul className="space-y-2 border rounded-md divide-y">
                      {relatedProductIds.map((rid, index) => (
                        <li key={rid} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">
                              {relatedProductTitles[rid] ?? rid}
                            </span>
                            <Link
                              href={`/admin/products/${rid}`}
                              className="text-xs text-muted-foreground hover:underline shrink-0"
                            >
                              Edit
                            </Link>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={index === 0}
                              onClick={() => {
                                const next = [...relatedProductIds];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                setRelatedProductIds(next);
                              }}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={index === relatedProductIds.length - 1}
                              onClick={() => {
                                const next = [...relatedProductIds];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                setRelatedProductIds(next);
                              }}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                setRelatedProductIds(relatedProductIds.filter((x) => x !== rid));
                                setRelatedProductTitles((prev) => {
                                  const next = { ...prev };
                                  delete next[rid];
                                  return next;
                                });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="relative">
                    <Input
                      placeholder="Search products to add..."
                      value={relatedSearchQuery}
                      onChange={(e) => setRelatedSearchQuery(e.target.value)}
                      className="pr-8"
                    />
                    {relatedSearchQuery.trim() && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 border bg-background rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {relatedSearching ? (
                          <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching...
                          </div>
                        ) : relatedSearchResults.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">No products found</div>
                        ) : (
                          relatedSearchResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                              onClick={() => {
                                setRelatedProductIds((prev) => [...prev, p.id]);
                                setRelatedProductTitles((prev) => ({ ...prev, [p.id]: p.title }));
                                setRelatedSearchQuery("");
                                setRelatedSearchResults([]);
                              }}
                            >
                              {p.title}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
