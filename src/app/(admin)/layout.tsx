import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Settings,
  Home,
  ChevronRight,
  BarChart3,
  FolderTree,
  Palette,
  ImageIcon,
  MapPin,
  ShieldAlert,
  PhoneOff,
  Ticket,
  FileText,
  MessageSquareQuote,
  Newspaper,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AdminMobileMenu } from "./admin-mobile-menu";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/constants";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { Metadata } from "next";

// Admin area: noindex covers every /admin/* page below it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface SidebarLinkItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const sidebarLinks: SidebarLinkItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "Stock audit", href: "/admin/stock-audit", icon: FileText },
  { name: "Categories", href: "/admin/categories", icon: FolderTree },
  { name: "Attributes", href: "/admin/attributes", icon: Palette },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Reviews", href: "/admin/reviews", icon: MessageSquareQuote },
  { name: "Blog", href: "/admin/blog", icon: Newspaper },
  { name: "Coupons", href: "/admin/coupons", icon: Ticket },
  { name: "Offers", href: "/admin/offers", icon: Gift },
  { name: "IP Bans", href: "/admin/ip-bans", icon: ShieldAlert },
  { name: "Phone Bans", href: "/admin/phone-bans", icon: PhoneOff },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Hero Slider", href: "/admin/hero", icon: ImageIcon },
  { name: "Cities", href: "/admin/cities", icon: MapPin },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

function AdminSidebar({ className = "" }: { className?: string }) {
  return (
    <aside className={className}>
      <nav className="space-y-1">
        {sidebarLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
          >
            <span className="flex items-center gap-3">
              <link.icon className="h-4 w-4" />
              {link.name}
            </span>
            {link.badge && (
              <Badge variant="secondary" className="text-xs">
                {link.badge}
              </Badge>
            )}
          </Link>
        ))}
        <Separator className="my-4" />
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
        >
          <Home className="h-4 w-4" />
          View Store
        </Link>
      </nav>
    </aside>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/admin");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="flex h-16 items-center px-4 md:px-6">
          <div className="flex items-center gap-4">
            {/* Mobile Menu - client-only Sheet to avoid Radix hydration mismatch */}
            <AdminMobileMenu>
              <Link href="/admin" className="flex items-center gap-2 mb-6">
                <Image
                  src="/logo.png"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-auto"
                />
                <span className="font-bold">Admin Panel</span>
              </Link>
              <AdminSidebar />
            </AdminMobileMenu>

            {/* Logo */}
            <Link href="/admin" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <span className="font-bold hidden sm:inline">{siteConfig.name}</span>
            </Link>
            
            <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Badge variant="outline" className="hidden sm:inline-flex">Admin</Badge>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Store
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 shrink-0 border-r bg-background overflow-y-auto">
          <div className="p-4">
            <AdminSidebar />
          </div>
        </div>

        {/* Content - scrollable area with visible scrollbar */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 overflow-y-auto overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
