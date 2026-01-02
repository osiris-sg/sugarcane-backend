"use client";

export const dynamic = "force-dynamic";

import { useUser, useClerk } from "@clerk/nextjs";
import { Settings, TrendingUp, Globe, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementBox } from "@/components/dashboard/management-box";
import { NavHeader } from "@/components/layout/nav-header";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  // Get role from user metadata (default to franchisee)
  const role = user?.publicMetadata?.role || "franchisee";
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">Supercane</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Globe className="h-4 w-4" />
            English
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="text-red-600 hover:bg-red-100 hover:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold">Supercane Vending Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome back, {user?.firstName || "User"}
          </p>
        </div>

        {/* Management Boxes */}
        <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
          {/* Operations - Owner only */}
          {isOwnerOrAdmin && (
            <ManagementBox
              title="Operations"
              description="Manage devices, stock levels, and maintenance alerts."
              href="/dashboard/operations"
              icon={Settings}
            />
          )}

          {/* Sales - All users */}
          <ManagementBox
            title="Sales"
            description="View sales data, revenue analytics, and customer insights."
            href="/dashboard/sales"
            icon={TrendingUp}
            className={!isOwnerOrAdmin ? "md:col-span-2 max-w-md mx-auto" : ""}
          />
        </div>

        {/* Role indicator for dev purposes */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            Logged in as: <span className="font-medium">{role}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
