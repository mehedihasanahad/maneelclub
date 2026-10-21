import { Suspense } from "react";
import { Metadata } from "next";
import { siteConfig } from "@/lib/constants";
import { absoluteUrl, canonical, itemListJsonLd, ogImages } from "@/lib/seo";
import { JsonLd } from "@/components/seo";
import { getAllProducts, getCategories, getColorOptionsFromDb } from "@/actions/products";
import { getSeoSettings } from "@/lib/settings";
import { ProductGridSkeleton } from "@/components/skeletons";
import { ShopHeader } from "@/components/shop/shop-header";
import { ShopContent } from "./shop-content";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();

  return {
    // Bare title: the root layout's `%s | <store>` template adds the suffix.
    title: seo.shopTitle,
    description: seo.shopDescription,
    // Filters and sorting live in the query string; they must all fold back to /shop.
    alternates: canonical("/shop"),
    openGraph: {
      title: `${seo.shopTitle} | ${seo.storeName}`,
      description: seo.shopDescription,
      url: absoluteUrl("/shop"),
      images: ogImages(),
      type: "website",
    },
  };
}

interface ShopPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    color?: string;
    size?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;

  const [productsResult, categoriesResult, colorOptions] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getColorOptionsFromDb(),
  ]);

  const allProducts = productsResult.data || [];
  const categories = categoriesResult.data || [];

  return (
    <div className="container py-8">
      {/* Listing markup: the products this page offers, in display order. */}
      <JsonLd
        data={itemListJsonLd(
          allProducts.map((p) => ({ title: p.title, slug: p.slug })),
          `Shop | ${siteConfig.name}`
        )}
      />
      {/*
        ShopHeader is a search/filter toolbar, not a heading, so the page needs
        its own h1. Visually hidden to leave the existing layout untouched.
      */}
      <h1 className="sr-only">Shop all products</h1>

      <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg mb-8" />}>
        <ShopHeader categories={categories} searchParams={params} />
      </Suspense>

      <Suspense fallback={<ProductGridSkeleton count={8} columns={3} />}>
        <ShopContent
          products={allProducts}
          categories={categories}
          colorOptions={colorOptions}
          searchParams={params}
        />
      </Suspense>
    </div>
  );
}
