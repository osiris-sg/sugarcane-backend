"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Monitor,
  List,
  Layers,
  ClipboardList,
  FileText,
  RotateCcw,
  BarChart3,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Users,
  UserPlus,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { NotificationToggle } from "@/components/notification-toggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Sidebar items for non-admin users (franchisee view)
const sidebarItemsFranchisee = [
  {
    title: "Orders",
    href: "/dashboard/sales",
    icon: FileText,
  },
  {
    title: "Order Management",
    icon: ClipboardList,
    children: [
      { title: "Sales Analytics", href: "/dashboard/sales/orders/analytics", icon: LayoutDashboard },
      { title: "Order Summary", href: "/dashboard/sales/orders/summary", icon: BarChart3 },
    ],
  },
];

// Sidebar items for admin users (flipped - Order Summary first)
const sidebarItemsAdmin = [
  {
    title: "Order Summary",
    href: "/dashboard/sales/orders/summary",
    icon: BarChart3,
  },
  {
    title: "Device Management",
    icon: Monitor,
    children: [
      { title: "Device List", href: "/dashboard/sales/equipment", icon: List },
      { title: "Device Grouping", href: "/dashboard/sales/equipment/grouping", icon: Layers },
    ],
  },
  {
    title: "Order Management",
    icon: ClipboardList,
    children: [
      { title: "Order List", href: "/dashboard/sales", icon: FileText },
      { title: "Sales Analytics", href: "/dashboard/sales/orders/analytics", icon: LayoutDashboard },
      { title: "Refund Records", href: "/dashboard/sales/orders/refunds", icon: RotateCcw },
    ],
  },
  {
    title: "User Management",
    icon: Users,
    children: [
      { title: "User List", href: "/dashboard/sales/users", icon: List },
      { title: "Add User", href: "/dashboard/sales/users/add", icon: UserPlus },
      { title: "Roles", href: "/dashboard/sales/users/roles", icon: Shield },
    ],
  },
];

function SidebarItem({ item, isCollapsed, isAdmin, onNavigate }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const isActive = pathname === item.href;

  // Filter children based on role
  const visibleChildren = item.children?.filter(child => !child.ownerOnly || isAdmin);
  const hasActiveChild = visibleChildren?.some((child) => pathname === child.href);

  if (item.children) {
    return (
      <Collapsible open={isOpen || hasActiveChild} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              hasActiveChild
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              {!isCollapsed && <span>{item.title}</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  (isOpen || hasActiveChild) && "rotate-180"
                )}
              />
            )}
          </button>
        </CollapsibleTrigger>
        {!isCollapsed && (
          <CollapsibleContent className="pl-4 pt-1">
            {visibleChildren.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === child.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <child.icon className="h-4 w-4" />
                <span>{child.title}</span>
              </Link>
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  }

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

export default function SalesLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin" || role === "finance";

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Use different sidebar items based on role
  const filteredItems = isAdmin ? sidebarItemsAdmin : sidebarItemsFranchisee;

  const handleMobileNavigate = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/supercane-logo.png" alt="Supercane" width={140} height={40} className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          "sticky top-0 h-screen border-r bg-background transition-all duration-300 hidden md:block",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Sidebar Header */}
        <div className="relative flex h-16 items-center justify-center border-b px-4">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center">
              <Image src="/supercane-logo.png" alt="Supercane" width={140} height={40} className="h-10 w-auto" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute right-2 h-8 w-8"
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
          {filteredItems.map((item) => (
            <SidebarItem key={item.title} item={item} isCollapsed={isCollapsed} isAdmin={isAdmin} />
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-4 left-0 right-0 space-y-1 px-3">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              isCollapsed && "justify-center"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            {!isCollapsed && <span>Back to Dashboard</span>}
          </Link>
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600",
              isCollapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={cn(
          "fixed top-14 left-0 bottom-0 z-40 w-64 border-r bg-background transition-transform duration-300 md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Navigation */}
        <nav className="space-y-1 p-3">
          {filteredItems.map((item) => (
            <SidebarItem
              key={item.title}
              item={item}
              isCollapsed={false}
              isAdmin={isAdmin}
              onNavigate={handleMobileNavigate}
            />
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-4 left-0 right-0 space-y-1 px-3">
          <Link
            href="/dashboard"
            onClick={handleMobileNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
