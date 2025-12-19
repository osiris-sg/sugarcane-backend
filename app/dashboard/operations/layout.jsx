"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  Wrench,
  Users,
  Truck,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  {
    title: "Overview",
    href: "/dashboard/operations",
    icon: LayoutDashboard,
  },
  {
    title: "Faults",
    href: "/dashboard/operations/faults",
    icon: AlertTriangle,
  },
  {
    title: "Maintenance Logs",
    href: "/dashboard/operations/maintenance-logs",
    icon: Wrench,
  },
  {
    title: "Driver Assignment",
    href: "/dashboard/operations/driver-assignment",
    icon: Truck,
  },
  {
    title: "User Management",
    href: "/dashboard/operations/users",
    icon: Users,
  },
];

function SidebarItem({ item, isCollapsed }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

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

export default function OperationsLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const role = user?.publicMetadata?.role || "franchisee";

  // Redirect non-owners
  if (isLoaded && role !== "owner") {
    redirect("/dashboard");
  }

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
              <span className="text-lg font-bold text-primary">Operations</span>
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
