"use client";

import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Shield, Crown, User, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const roles = [
  {
    name: "Owner",
    icon: Crown,
    color: "amber",
    description: "Full administrative access to all dashboard features",
    permissions: [
      { name: "View Sales Overview", allowed: true },
      { name: "View Device Management", allowed: true },
      { name: "View Order Management", allowed: true },
      { name: "Access Operations Dashboard", allowed: true },
      { name: "Manage Users", allowed: true },
      { name: "Create/Edit/Delete Devices", allowed: true },
      { name: "Manage Device Groups", allowed: true },
      { name: "Export Data", allowed: true },
    ],
  },
  {
    name: "Franchisee",
    icon: User,
    color: "green",
    description: "View-only access to sales and order data",
    permissions: [
      { name: "View Sales Overview", allowed: true },
      { name: "View Device Management", allowed: true },
      { name: "View Order Management", allowed: true },
      { name: "Access Operations Dashboard", allowed: false },
      { name: "Manage Users", allowed: false },
      { name: "Create/Edit/Delete Devices", allowed: false },
      { name: "Manage Device Groups", allowed: false },
      { name: "Export Data", allowed: true },
    ],
  },
];

export default function RolesPage() {
  const { user, isLoaded } = useUser();

  // Redirect non-admins
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin" || role === "finance";
  if (isLoaded && !isAdmin) {
    redirect("/dashboard/sales");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 md:h-16 items-center px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">User Roles</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Understanding role permissions
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="mb-4 md:mb-6">
          <Card>
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Shield className="h-4 w-4 md:h-5 md:w-5" />
                Role-Based Access Control
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Users are assigned roles that determine what features they can access.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.name}>
              <CardHeader className="px-4 md:px-6">
                <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-lg">
                  <div
                    className={`rounded-full p-1.5 md:p-2 ${
                      role.color === "amber"
                        ? "bg-amber-100"
                        : "bg-green-100"
                    }`}
                  >
                    <role.icon
                      className={`h-4 w-4 md:h-5 md:w-5 ${
                        role.color === "amber"
                          ? "text-amber-600"
                          : "text-green-600"
                      }`}
                    />
                  </div>
                  {role.name}
                  <Badge
                    variant={role.name === "Owner" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {role.name === "Owner" ? "Admin" : "Standard"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">{role.description}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 md:px-6">
                <div className="space-y-2 md:space-y-3">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">
                    Permissions
                  </p>
                  <div className="space-y-1.5 md:space-y-2">
                    {role.permissions.map((permission) => (
                      <div
                        key={permission.name}
                        className="flex items-center justify-between rounded-lg bg-muted/50 px-2 md:px-3 py-1.5 md:py-2"
                      >
                        <span className="text-xs md:text-sm">{permission.name}</span>
                        {permission.allowed ? (
                          <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
                        ) : (
                          <X className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-4 md:mt-6">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="text-base md:text-lg">How to Assign Roles</CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6 space-y-3 md:space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 md:p-4">
              <h4 className="font-medium text-sm md:text-base">1. When Creating a User</h4>
              <p className="text-xs md:text-sm text-muted-foreground">
                Select the desired role from the dropdown when adding a new user.
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 md:p-4">
              <h4 className="font-medium text-sm md:text-base">2. Editing Existing Users</h4>
              <p className="text-xs md:text-sm text-muted-foreground">
                Go to User List, click the actions menu on a user, and select "Edit Role".
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 md:p-4">
              <h4 className="font-medium text-sm md:text-base">3. Via Clerk Dashboard</h4>
              <p className="text-xs md:text-sm text-muted-foreground">
                You can also manage user metadata directly in the Clerk Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
