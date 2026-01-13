"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Lock, User, Crown, ArrowLeft, AtSign, Shield, Wallet, Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function AddUserPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    role: "franchisee",
  });

  // Redirect non-admins
  const userRole = user?.publicMetadata?.role || "franchisee";
  const isAdmin = userRole === "owner" || userRole === "admin";
  if (isLoaded && !isAdmin) {
    redirect("/dashboard/sales");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          firstName: formData.firstName,
          lastName: formData.lastName,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("User created successfully");
        router.push("/dashboard/sales/users");
      } else {
        toast.error(data.error || "Failed to create user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 md:h-16 items-center gap-3 md:gap-4 px-4 md:px-6">
          <Link href="/dashboard/sales/users">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Add New User</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Create a new user account
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <UserPlus className="h-4 w-4 md:h-5 md:w-5" />
                User Details
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Fill in the details to create a new user account
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="johndoe"
                      className="pl-9"
                      required
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Username must be lowercase with no spaces
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters"
                      className="pl-9"
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm password"
                      className="pl-9"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          Owner - Full access to all features
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Admin - Full access to all features
                        </div>
                      </SelectItem>
                      <SelectItem value="finance">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Finance - Access to financial data
                        </div>
                      </SelectItem>
                      <SelectItem value="franchisee">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Franchisee - View own sales data
                        </div>
                      </SelectItem>
                      <SelectItem value="partnerships">
                        <div className="flex items-center gap-2">
                          <Handshake className="h-4 w-4" />
                          Partnerships - Limited sales view
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push("/dashboard/sales/users")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
