// ==================== SITE CONFIGURATION ====================

export const siteConfig = {
  name: "Maneel Club",
  description: "Premium clothing brand in Bangladesh",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/og-image.jpg",
  
  // Contact
  whatsapp: "+8801997193518",
  whatsappLink: "https://wa.me/8801997193518",
  facebook: "https://www.facebook.com/maneelclub",
  email: "support@maneelclub.com",
  
  // Currency
  currency: "BDT",
  currencySymbol: "BDT ",

  // Location
  country: "Bangladesh",

  // Development company (surfaced in SEO/AEO metadata + structured data)
  developer: {
    name: "Arrowbin",
    url: "https://arrowbin.com",
  },
} as const;

// ==================== SHIPPING ====================

export const SHIPPING_RATES = {
  dhaka: 80,
  outside: 130,
} as const;

// Cities/Districts for checkout dropdown
export const CITIES = [
  { value: "dhaka", label: "Dhaka", shippingCost: SHIPPING_RATES.dhaka },
  { value: "chittagong", label: "Chittagong", shippingCost: SHIPPING_RATES.outside },
  { value: "sylhet", label: "Sylhet", shippingCost: SHIPPING_RATES.outside },
  { value: "rajshahi", label: "Rajshahi", shippingCost: SHIPPING_RATES.outside },
  { value: "khulna", label: "Khulna", shippingCost: SHIPPING_RATES.outside },
  { value: "barishal", label: "Barishal", shippingCost: SHIPPING_RATES.outside },
  { value: "rangpur", label: "Rangpur", shippingCost: SHIPPING_RATES.outside },
  { value: "mymensingh", label: "Mymensingh", shippingCost: SHIPPING_RATES.outside },
  { value: "comilla", label: "Comilla", shippingCost: SHIPPING_RATES.outside },
  { value: "gazipur", label: "Gazipur", shippingCost: SHIPPING_RATES.dhaka },
  { value: "narayanganj", label: "Narayanganj", shippingCost: SHIPPING_RATES.dhaka },
] as const;

export type CityValue = (typeof CITIES)[number]["value"];

// Get shipping cost by city
export function getShippingCost(city: string): number {
  const found = CITIES.find((c) => c.value === city);
  return found?.shippingCost ?? SHIPPING_RATES.outside;
}

// ==================== PAYMENT ====================

export const MERCHANT_PHONE = "01854938837";

export const PAYMENT_METHODS = [
  {
    value: "COD",
    label: "Cash on Delivery",
    labelBn: "ক্যাশ অন ডেলিভারি",
    description: "Pay when you receive your order",
    descriptionBn: "অর্ডার হাতে পেলে টাকা দিন",
    instructions: null,
  },
  {
    value: "BKASH",
    label: "bKash",
    labelBn: "বিকাশ",
    description: "Pay with bKash mobile banking",
    descriptionBn: "বিকাশ মোবাইল ব্যাংকিং দিয়ে পেমেন্ট করুন",
    instructions: `১. আপনার মোবাইল থেকে *247# ডায়াল করুন
২. প্রদর্শিত মেনু থেকে 3 চাপুন (Send Money)
৩. নম্বরটি লিখুন: বিকাশ পার্সোনাল (${MERCHANT_PHONE})
৪. কত টাকা পাঠাতে চান তা লিখুন এবং নিশ্চিত করুন
৫. আপনার bKash PIN লিখুন এবং প্রক্রিয়া সম্পন্ন করুন
৬. নিচে আপনার বিকাশ নাম্বার এবং Transaction ID টি লিখুন`,
    merchantNumber: MERCHANT_PHONE,
    dialCode: "*247#",
  },
  {
    value: "NAGAD",
    label: "Nagad",
    labelBn: "নগদ",
    description: "Pay with Nagad mobile banking",
    descriptionBn: "নগদ মোবাইল ব্যাংকিং দিয়ে পেমেন্ট করুন",
    instructions: `১. আপনার মোবাইল থেকে *167# ডায়াল করুন
২. প্রদর্শিত মেনু থেকে 1 চাপুন (Send Money)
৩. নম্বরটি লিখুন: নগদ পার্সোনাল (${MERCHANT_PHONE})
৪. কত টাকা পাঠাতে চান তা লিখুন এবং নিশ্চিত করুন
৫. আপনার নগদ PIN লিখুন এবং প্রক্রিয়া সম্পন্ন করুন
৬. নিচে আপনার নগদ নাম্বার এবং Transaction ID টি লিখুন`,
    merchantNumber: MERCHANT_PHONE,
    dialCode: "*167#",
  },
  {
    value: "ROCKET",
    label: "Rocket",
    labelBn: "রকেট",
    description: "Pay with Rocket mobile banking",
    descriptionBn: "রকেট মোবাইল ব্যাংকিং দিয়ে পেমেন্ট করুন",
    instructions: `১. আপনার মোবাইল থেকে *322# ডায়াল করুন
২. প্রদর্শিত মেনু থেকে 1 চাপুন (Send Money)
৩. নম্বরটি লিখুন: রকেট পার্সোনাল (${MERCHANT_PHONE})
৪. কত টাকা পাঠাতে চান তা লিখুন এবং নিশ্চিত করুন
৫. আপনার রকেট PIN লিখুন এবং প্রক্রিয়া সম্পন্ন করুন
৬. নিচে আপনার রকেট নাম্বার এবং Transaction ID টি লিখুন`,
    merchantNumber: MERCHANT_PHONE,
    dialCode: "*322#",
  },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];

// Payment status display
export const PAYMENT_STATUS = {
  PENDING: { label: "Hold", labelBn: "অপেক্ষমাণ", color: "bg-yellow-100 text-yellow-800" },
  PAID: { label: "Paid", labelBn: "পেইড", color: "bg-green-100 text-green-800" },
  FAILED: { label: "Failed", labelBn: "ব্যর্থ", color: "bg-red-100 text-red-800" },
} as const;

export const PAYMENT_STATUSES = [
  { value: "PENDING", label: "Hold", labelBn: "অপেক্ষমাণ", color: "bg-yellow-100 text-yellow-800" },
  { value: "PAID", label: "Paid", labelBn: "পেইড", color: "bg-green-100 text-green-800" },
  { value: "FAILED", label: "Failed", labelBn: "ব্যর্থ", color: "bg-red-100 text-red-800" },
] as const;

// ==================== ORDER STATUS ====================

export const ORDER_STATUS = {
  PENDING: { label: "Hold", color: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmed", color: "bg-blue-100 text-blue-800" }, // Legacy - kept for existing orders
  PROCESSING: { label: "Processing", color: "bg-purple-100 text-purple-800" },
  SHIPPED: { label: "Shipped", color: "bg-green-100 text-green-700" },
  DELIVERED: { label: "Delivered", color: "bg-green-200 text-green-900" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
} as const;

// Array format for dropdowns/selects (CONFIRMED kept for legacy orders display only)
export const ORDER_STATUSES = [
  { value: "PENDING", label: "Hold", color: "bg-yellow-100 text-yellow-800" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-blue-100 text-blue-800" },
  { value: "PROCESSING", label: "Processing", color: "bg-purple-100 text-purple-800" },
  { value: "SHIPPED", label: "Shipped", color: "bg-green-100 text-green-700" },
  { value: "DELIVERED", label: "Delivered", color: "bg-green-200 text-green-900" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
] as const;


// ==================== PRODUCT ====================

/** Stock value used for "unlimited" in admin; frontend shows "In stock" instead of the number when >= this */
export const UNLIMITED_STOCK = 999999;

export const PRODUCT_COLORS = [
  { value: "black", label: "Black", hex: "#000000" },
  { value: "white", label: "White", hex: "#FFFFFF" },
  { value: "offwhite", label: "Off White", hex: "#FAF9F6" },
  { value: "navy", label: "Navy", hex: "#000080" },
  { value: "burgundy-maroon", label: "Burgundy Maroon", hex: "#800020" },
  { value: "bottle-green", label: "Bottle Green", hex: "#006A4E" },
  { value: "coffee", label: "Coffee", hex: "#6F4E37" },
  { value: "dark-gray", label: "Dark Gray", hex: "#4A4A4A" },
  { value: "light-biscuit", label: "Light Biscuit", hex: "#D4A574" },
  { value: "sea-blue", label: "Sea Blue", hex: "#006994" },
  { value: "teal-green", label: "Teal Green", hex: "#008080" },
] as const;

export const PRODUCT_SIZES = ["S", "M", "L", "XL", "XXL"] as const;

export type ProductSize = (typeof PRODUCT_SIZES)[number];

// ==================== PAGINATION ====================

export const PRODUCTS_PER_PAGE = 12;
export const ORDERS_PER_PAGE = 10;

// ==================== ANNOUNCEMENT ====================

export const ANNOUNCEMENT = {
  enabled: true,
  message: "Free shipping on orders over BDT 2000!",
  link: "/shop",
  linkText: "Shop Now",
} as const;
