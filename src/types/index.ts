// ==================== PRODUCT TYPES ====================

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  regularPrice: number | string;
  salePrice: number | string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  trackInventory?: boolean;
  /** WooCommerce-style: SIMPLE (single price/stock) or VARIABLE (variants) */
  productType?: "SIMPLE" | "VARIABLE";
  /** Admin SEO overrides; null/empty means the storefront derives the value. */
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sizeChart: SizeChart | null;
  categoryId: string | null;
  category?: Category | null;
  categorySlug?: string;
  /** All category slugs this product belongs to (many-to-many); used for shop filtering */
  categorySlugs?: string[];
  categoryName?: string;
  variants?: ProductVariant[];
  /** Map of color display name -> hex for storefront swatches (from attribute metadata) */
  colorHexMap?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  // Frontend convenience fields
  image?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  color: string;
  size: string;
  stock: number;
  sku: string | null;
  /** Sale price override for this variant; if set, used instead of product-level salePrice */
  price?: number | string | null;
  /** Variant-specific images (e.g. per color); falls back to product images when empty */
  images?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  /** Admin SEO overrides; null/empty means the storefront derives the value. */
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  products?: Product[];
  parent?: Category | null;
  children?: Category[];
  _count?: {
    products: number;
  };
}

export interface SizeChart {
  headers: string[];
  rows: SizeChartRow[];
}

export interface SizeChartRow {
  size: string;
  measurements: string[];
}

// ==================== CART TYPES ====================

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  slug: string;
  image: string;
  price: number;
  color: string;
  size: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
}

// ==================== ORDER TYPES ====================

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  altPhone: string | null;
  deliveryNote: string | null;
  shippingCost: number | string;
  subtotal: number | string;
  total: number | string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItem[];
  user?: User | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  color: string;
  size: string;
  quantity: number;
  price: number | string;
  product?: Product;
}

// ==================== USER TYPES ====================

export type UserRole = "CUSTOMER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  image: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  userId: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  altPhone: string | null;
  isDefault: boolean;
}

// ==================== FORM TYPES ====================

export interface CheckoutFormData {
  fullName: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
  altPhone?: string;
  deliveryNote?: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== FILTER TYPES ====================

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  sortBy?: "newest" | "price-asc" | "price-desc" | "name";
}
