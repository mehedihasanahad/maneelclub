import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getProductBySlug } from "@/actions/products";
import { siteConfig } from "@/lib/constants";
import { ProductDetails } from "./product-details";
import { RelatedProducts } from "@/components/product";
import { getReviewsForProduct, getSocialProofSettings } from "@/lib/reviews";
import { aggregateRating } from "@/lib/reviews-shared";
import { getShippingRates, getFreeShippingMinimum } from "@/lib/settings";
import {
  absoluteImageUrl,
  absoluteUrl,
  breadcrumbJsonLd,
  canonical,
  productJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/seo";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: product } = await getProductBySlug(slug);
  
  if (!product) {
    return {
      title: "Product Not Found",
    };
  }
  
  // Admin-set SEO overrides win; otherwise fall back to the product's own
  // title/description exactly as before.
  const description =
    product.metaDescription ||
    product.description ||
    `Buy ${product.title} at ${siteConfig.name}`;
  const metaTitle = product.metaTitle || product.title;

  return {
    // `absolute` when the admin set a meta title, so their wording is used
    // verbatim rather than having the brand suffix appended to it.
    title: product.metaTitle ? { absolute: product.metaTitle } : product.title,
    description,
    alternates: product.canonicalUrl
      ? { canonical: product.canonicalUrl }
      : canonical(`/product/${product.slug}`),
    openGraph: {
      type: "website",
      title: metaTitle,
      description,
      url: absoluteUrl(`/product/${product.slug}`),
      images: product.images[0] ? [absoluteImageUrl(product.images[0])] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description,
      images: product.images[0] ? [absoluteImageUrl(product.images[0])] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const { data: product, error } = await getProductBySlug(slug);
  
  if (error || !product) {
    notFound();
  }

  const [reviews, socialProof, shippingRates, freeShippingMinimum] = await Promise.all([
    getReviewsForProduct(product.id, 10),
    getSocialProofSettings(),
    getShippingRates(),
    getFreeShippingMinimum(),
  ]);

  // Mirrors the storefront's own availability rule (see product-details.tsx):
  // when inventory is not tracked the item is always purchasable, otherwise it
  // needs stock on the product or on at least one variant.
  const trackInventory =
    product.trackInventory || product.productType === "VARIABLE";
  const inStock = !trackInventory
    ? true
    : (product.variants?.length
        ? product.variants.some((v) => v.stock > 0)
        : product.stock > 0);

  const salePrice =
    product.salePrice != null ? Number(product.salePrice) : null;
  const price = salePrice ?? Number(product.regularPrice);

  const breadcrumbTrail = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    ...(product.category
      ? [
          {
            name: product.category.name,
            path: `/product-category/${product.category.slug}`,
          },
        ]
      : []),
    { name: product.title, path: `/product/${product.slug}` },
  ];

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            title: product.title,
            slug: product.slug,
            description: product.description,
            images: product.images,
            price,
            inStock,
            categoryName: product.category?.name ?? null,
            // Same helper the page uses to render the visible star summary.
            rating: aggregateRating(reviews, product.id),
            shipping: {
              dhaka: shippingRates.dhaka,
              outside: shippingRates.outside,
              freeOver: freeShippingMinimum,
            },
          }),
          breadcrumbJsonLd(breadcrumbTrail),
        ]}
      />
      {/* key: remount per product so colour/size selection never carries over between products */}
      <ProductDetails
        key={product.id}
        product={{
          ...product,
          regularPrice: Number(product.regularPrice),
          salePrice: product.salePrice != null ? Number(product.salePrice) : null,
          category: product.category ?? null,
        }}
        reviews={reviews}
        socialProof={socialProof}
      />
      
      <RelatedProducts
        productId={product.id}
        categoryId={product.categoryId ?? undefined}
        limit={4}
      />
    </>
  );
}
