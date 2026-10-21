import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getProductsByCategory, getCategories } from "@/actions/products";
import { siteConfig } from "@/lib/constants";
import { ProductGrid } from "@/components/product";
import { CategoryHeader } from "./category-header";
import { ProductSort } from "./product-sort";
import { absoluteUrl, breadcrumbJsonLd, canonical, itemListJsonLd, ogImages } from "@/lib/seo";
import { JsonLd } from "@/components/seo";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

// Get category info from database
async function getCategoryInfo(slug: string) {
  const { data: categories } = await getCategories();
  return categories?.find((c) => c.slug === slug) || null;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryInfo(slug);
  
  if (!category && slug !== "all") {
    return {
      title: "Category Not Found",
    };
  }
  
  const title = slug === "all" ? "All Products" : category?.name || "Products";
  // Admin-set SEO overrides win; otherwise fall back to name/description.
  const description =
    category?.metaDescription ||
    category?.description ||
    `Shop ${title} at ${siteConfig.name}`;
  const metaTitle = category?.metaTitle || title;

  return {
    // `absolute` when the admin set a meta title, so their wording is used
    // verbatim rather than having the brand suffix appended to it.
    title: category?.metaTitle ? { absolute: category.metaTitle } : title,
    description,
    // Sorting is a query param; every ?sort= variant folds back to this URL.
    alternates: category?.canonicalUrl
      ? { canonical: category.canonicalUrl }
      : canonical(`/product-category/${slug}`),
    openGraph: {
      type: "website",
      title: `${metaTitle} | ${siteConfig.name}`,
      description,
      url: absoluteUrl(`/product-category/${slug}`),
      images: ogImages(),
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { sort } = await searchParams;
  
  // Handle "all" products
  if (slug === "all") {
    const { data: allProducts } = await getProductsByCategory("all");
    const products = sortProducts(allProducts || [], sort);
    
    return (
      <div className="container py-8">
        <JsonLd
          data={[
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "All Products", path: "/product-category/all" },
            ]),
            itemListJsonLd(
              products.map((p) => ({ title: p.title, slug: p.slug })),
              `All Products | ${siteConfig.name}`
            ),
          ]}
        />
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">All Products</span>
        </nav>
        
        <CategoryHeader 
          title="All Products" 
          description="Browse our complete collection of premium clothing"
          productCount={products.length}
        />
        
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
          <ProductSort currentSort={sort} />
        </div>
        
        {products.length > 0 ? (
          <ProductGrid products={products} columns={4} />
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>No products available yet.</p>
          </div>
        )}
      </div>
    );
  }
  
  // Get category info
  const category = await getCategoryInfo(slug);
  
  if (!category) {
    notFound();
  }
  
  // Get products for this category
  const { data: categoryProducts } = await getProductsByCategory(slug);
  const products = sortProducts(categoryProducts || [], sort);
  
  return (
    <div className="container py-8">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: category.name, path: `/product-category/${slug}` },
          ]),
          itemListJsonLd(
            products.map((p) => ({ title: p.title, slug: p.slug })),
            `${category.name} | ${siteConfig.name}`
          ),
        ]}
      />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{category.name}</span>
      </nav>
      
      <CategoryHeader 
        title={category.name} 
        description={category.description}
        productCount={products.length}
      />
      
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
        <ProductSort currentSort={sort} />
      </div>
      
      {products.length > 0 ? (
        <ProductGrid products={products} columns={4} />
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p>No products found in this category.</p>
          <Link href="/shop" className="text-primary hover:underline mt-2 inline-block">
            Browse all products
          </Link>
        </div>
      )}
    </div>
  );
}

// Sort products helper
function sortProducts(products: any[], sort?: string) {
  if (!sort || !products.length) return products;
  
  const sorted = [...products];
  
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => {
        const priceA = (a.salePrice ?? a.regularPrice) as number;
        const priceB = (b.salePrice ?? b.regularPrice) as number;
        return priceA - priceB;
      });
    case "price-desc":
      return sorted.sort((a, b) => {
        const priceA = (a.salePrice ?? a.regularPrice) as number;
        const priceB = (b.salePrice ?? b.regularPrice) as number;
        return priceB - priceA;
      });
    case "newest":
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "name-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}
