"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk, UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import {
  Package,
  Warehouse,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { NotificationToggle } from "@/components/notification-toggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  {
    title: "Stock",
    href: "/dashboard/operations/inventory/stock",
    icon: Package,
  },
  {
    title: "Storage",
    href: "/dashboard/operations/inventory/storage",
    icon: Warehouse,
  },
  {
    title: "Stock Prediction",
    href: "/dashboard/operations/inventory/prediction",
    icon: TrendingUp,
  },
];

function SidebarItem({ item, isCollapsed, onNavigate }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4" />
      {!isCollapsed && <span>{item.title}</span>}
    </Link>
  );
}

export default function InventoryLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const role = user?.publicMetadata?.role || "franchisee";
  const roleLower = role?.toLowerCase();
  const isAdmin = roleLower === "owner" || roleLower === "admin";
  const isOpsManager = roleLower === "opsmanager" || roleLower === "ops_manager";
  const canAccess = isAdmin || isOpsManager;

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Redirect users who can't access inventory
  if (isLoaded && !canAccess) {
    redirect("/dashboard");
  }

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link href="/dashboard/operations" className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">Inventory</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-9 w-9"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed top-14 left-0 bottom-0 z-40 w-64 border-r bg-background transition-transform duration-300 md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="space-y-1 p-3">
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.title}
              item={item}
              isCollapsed={false}
              onNavigate={closeMobileMenu}
            />
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-4 left-0 right-0 space-y-1 px-3">
          <Link
            href="/dashboard/operations"
            onClick={closeMobileMenu}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Operations</span>
          </Link>
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <UserButton afterSignOutUrl="/sign-in" />
              <span>Account</span>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "sticky top-0 h-screen border-r bg-background transition-all duration-300 hidden md:block",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <Link href="/dashboard/operations" className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">Inventory</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 p-3">
          {sidebarItems.map((item) => (
            <SidebarItem key={item.title} item={item} isCollapsed={isCollapsed} />
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-4 left-0 right-0 space-y-1 px-3">
          <Link
            href="/dashboard/operations"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              isCollapsed && "justify-center"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            {!isCollapsed && <span>Back to Operations</span>}
          </Link>
          <div
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground",
              isCollapsed && "justify-center"
            )}
          >
            <div className="flex items-center gap-2">
              <UserButton afterSignOutUrl="/sign-in" />
              {!isCollapsed && <span>Account</span>}
            </div>
            {!isCollapsed && (
              <button
                onClick={() => signOut({ redirectUrl: "/sign-in" })}
                className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          {isCollapsed && (
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
