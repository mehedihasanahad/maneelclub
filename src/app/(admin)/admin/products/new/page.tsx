"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Plus, Package } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProduct, getAdminCategories } from "@/actions/admin/products";
import { AttributeSelector, ImageUploader, VariantMatrix, SizeGuideEditor, SeoFields } from "@/components/admin";
import type { SizeChartValue } from "@/components/admin/size-guide-editor";
import { slugify } from "@/lib/format";
import { toast } from "sonner";
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

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  
  // Attribute and variant state
  const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttribute[]>([]);
  const [variantStocks, setVariantStocks] = useState<VariantStock>({});
  const [sizeChart, setSizeChart] = useState<SizeChartValue | null>(null);

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
    async function loadCategories() {
      const result = await getAdminCategories();
      if (result.success) {
        setCategories(result.data as Category[]);
      }
    }
    loadCategories();
  }, []);

  // Auto-generate slug from title
  const title = form.watch("title");
  useEffect(() => {
    if (title) {
      form.setValue("slug", slugify(title));
    }
  }, [title, form]);

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

    setLoading(true);
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
        : [];

      const result = await createProduct(
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
          sizeChart: sizeChart && sizeChart.headers.length > 0 && sizeChart.rows.length > 0 ? sizeChart : null,
          categoryIds: selectedCategoryIds,
        },
        variantsData
      );

      if (result.success) {
        toast.success("Product created successfully");
        router.push("/admin/products");
      } else {
        toast.error(result.error || "Failed to create product");
      }
    } catch (error) {
      toast.error("Failed to create product");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-bold">Add New Product</h1>
          <p className="text-muted-foreground">
            Create a new product for your store
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
                    Upload product images or use the default placeholder
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Product
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
