"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Monitor,
  List,
  Layers,
  Activity,
  Wallet,
  ClipboardList,
  FileText,
  RotateCcw,
  AlertTriangle,
  BarChart3,
  Package,
  Menu as MenuIcon,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
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
    title: "Equipment Management",
    icon: Monitor,
    children: [
      { title: "Equipment List", href: "/dashboard/sales/equipment", icon: List },
      { title: "Equipment Grouping", href: "/dashboard/sales/equipment/grouping", icon: Layers },
      { title: "Equipment Status", href: "/dashboard/sales/equipment/status", icon: Activity },
      { title: "Cash Records", href: "/dashboard/sales/equipment/cash", icon: Wallet },
    ],
  },
  {
    title: "Order Management",
    icon: ClipboardList,
    children: [
      { title: "Order List", href: "/dashboard/sales/orders", icon: FileText },
      { title: "Order Summary", href: "/dashboard/sales/orders/summary", icon: BarChart3 },
      { title: "Refund Records", href: "/dashboard/sales/orders/refunds", icon: RotateCcw },
    ],
  },
  {
    title: "Fault Management",
    icon: AlertTriangle,
    children: [
      { title: "Fault Log", href: "/dashboard/sales/faults", icon: FileText },
      { title: "Fault Summary", href: "/dashboard/sales/faults/summary", icon: BarChart3 },
    ],
  },
  {
    title: "Sales Management",
    icon: Package,
    children: [
      { title: "Product Management", href: "/dashboard/sales/products", icon: Package },
      { title: "Sales Menu", href: "/dashboard/sales/menu", icon: MenuIcon },
    ],
  },
];

function SidebarItem({ item, isCollapsed }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const isActive = pathname === item.href;
  const hasActiveChild = item.children?.some((child) => pathname === child.href);

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
            {item.children.map((child) => (
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
              <span className="text-lg font-bold text-primary">Sugarcane</span>
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

        {/* Back to Dashboard */}
        <div className="absolute bottom-4 left-0 right-0 px-3">
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
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
