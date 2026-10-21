import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  MapPin,
  User,
  Menu,
  Home,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/constants";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// Private account area: noindex covers every /dashboard/* page below it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const sidebarLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { name: "Addresses", href: "/dashboard/addresses", icon: MapPin },
  { name: "Profile", href: "/dashboard/profile", icon: User },
];

function Sidebar({ className = "" }: { className?: string }) {
  return (
    <aside className={className}>
      <nav className="space-y-1">
        {sidebarLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
          >
            <link.icon className="h-4 w-4" />
            {link.name}
          </Link>
        ))}
        <Separator className="my-4" />
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
        >
          <Home className="h-4 w-4" />
          Back to Shop
        </Link>
      </nav>
    </aside>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/dashboard");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="py-4">
                  <Link href="/" className="flex items-center gap-2 mb-6">
                    <Image
                      src="/logo.png"
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-auto"
                    />
                    <span className="font-bold">{siteConfig.name}</span>
                  </Link>
                  <Sidebar />
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
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
            <span className="text-sm font-medium hidden sm:block">My Account</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Shop
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <Sidebar className="hidden lg:block w-64 flex-shrink-0" />

          {/* Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
