"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unsubscribePushNotifications } from "@/lib/push-utils";

export default function ChangePasswordPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Check if user needs to change password
  const requirePasswordChange = user?.publicMetadata?.requirePasswordChange;

  // Handle sign out - unsubscribe from push notifications first
  const handleSignOut = async () => {
    await unsubscribePushNotifications();
    signOut({ redirectUrl: "/sign-in" });
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    setLoading(true);

    try {
      // Update password using Clerk
      await user.updatePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      // Mark password as changed via API
      const res = await fetch("/api/auth/mark-password-changed", {
        method: "POST",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Password changed successfully!");
        // Force reload to refresh Clerk session data, then redirect
        window.location.href = "/dashboard";
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      if (error.errors?.[0]?.message) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to change password. Please check your current password.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      // Mark password as changed via API (skipping actual change)
      const res = await fetch("/api/auth/mark-password-changed", {
        method: "POST",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Continuing with current password");
        // Force reload to refresh Clerk session data, then redirect
        window.location.href = "/dashboard";
      } else {
        toast.error(data.error || "Failed to continue");
      }
    } catch (error) {
      console.error("Error skipping password change:", error);
      toast.error("Failed to continue. Please try again.");
    } finally {
      setSkipping(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    router.push("/sign-in");
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center px-4 md:px-6">
          <div className="mx-auto mb-3 md:mb-4 flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-full bg-amber-100">
            <ShieldCheck className="h-6 w-6 md:h-8 md:w-8 text-amber-600" />
          </div>
          <CardTitle className="text-xl md:text-2xl">Change Your Password</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {requirePasswordChange
              ? "For security, you must change your password before continuing."
              : "Update your password to keep your account secure."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter your current password"
                  className="pl-9"
                  required
                  value={formData.currentPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, currentPassword: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This is the temporary password you were given
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="At least 8 characters"
                  className="pl-9"
                  required
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
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

            <Button type="submit" className="w-full" disabled={loading || skipping}>
              {loading ? "Changing Password..." : "Change Password"}
            </Button>

            {requirePasswordChange && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || skipping}
                  onClick={handleSkip}
                >
                  {skipping ? "Continuing..." : "Continue with Current Password"}
                </Button>
              </>
            )}
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              className="text-muted-foreground"
              onClick={handleSignOut}
            >
              Sign out and use a different account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
