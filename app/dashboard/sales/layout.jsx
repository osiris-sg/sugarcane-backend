"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const sidebarItems = [
  {
    title: "Overview",
    href: "/dashboard/sales",
    icon: LayoutDashboard,
  },
  {
    title: "Device Management",
    icon: Monitor,
    ownerOnly: true,
    children: [
      { title: "Device List", href: "/dashboard/sales/equipment", icon: List },
      { title: "Device Grouping", href: "/dashboard/sales/equipment/grouping", icon: Layers },
    ],
  },
  {
    title: "Order Management",
    icon: ClipboardList,
    children: [
      { title: "Order List", href: "/dashboard/sales/orders", icon: FileText },
      { title: "Order Summary", href: "/dashboard/sales/orders/summary", icon: BarChart3 },
      { title: "Refund Records", href: "/dashboard/sales/orders/refunds", icon: RotateCcw, ownerOnly: true },
    ],
  },
  {
    title: "User Management",
    icon: Users,
    ownerOnly: true,
    children: [
      { title: "User List", href: "/dashboard/sales/users", icon: List },
      { title: "Add User", href: "/dashboard/sales/users/add", icon: UserPlus },
      { title: "Roles", href: "/dashboard/sales/users/roles", icon: Shield },
    ],
  },
];

function SidebarItem({ item, isCollapsed, isAdmin }) {
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
  const { user } = useUser();
  const { signOut } = useClerk();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";

  // Filter sidebar items based on role
  const filteredItems = sidebarItems.filter(item => !item.ownerOnly || isAdmin);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 h-screen border-r bg-background transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">Supercane</span>
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
