"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Package,
  Settings,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function MachineEditPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useUserRoles();

  const [device, setDevice] = useState(null);
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [minStockThreshold, setMinStockThreshold] = useState(20);
  const [maxStock, setMaxStock] = useState(80);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch(`/api/operations/machines/${params.id}`);
      const data = await res.json();

      if (data.success) {
        setDevice(data.device);
        setStock(data.stock);
        setMinStockThreshold(data.stock?.minStockThreshold ?? 20);
        setMaxStock(data.stock?.maxStock ?? 80);
      } else {
        toast.error(data.error || "Failed to load device");
      }
    } catch (error) {
      console.error("Error fetching device:", error);
      toast.error("Failed to load device");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!isAdmin) {
      toast.error("Only admins can modify settings");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/operations/machines/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minStockThreshold: parseInt(minStockThreshold, 10),
          maxStock: parseInt(maxStock, 10),
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Settings saved successfully");
        setStock(data.stock);
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-30 border-b bg-background shrink-0">
          <div className="flex h-14 md:h-16 items-center px-4 md:px-6">
            <Link href="/dashboard/operations">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-medium">Device not found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The device you're looking for doesn't exist.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/operations">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-lg md:text-xl font-semibold">
                {device.deviceName || device.deviceId}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Operations Settings
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Device Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Device ID</Label>
                  <p className="font-medium">{device.deviceId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Device Name</Label>
                  <p className="font-medium">{device.deviceName || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Location</Label>
                  <p className="font-medium">{device.location || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Badge variant={device.isActive ? "success" : "destructive"}>
                    {device.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Stock Alert Settings
              </CardTitle>
              <CardDescription>
                Configure when low stock alerts are triggered for this machine
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Stock Display */}
              {stock && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Current Stock</span>
                    <span className="font-bold">
                      {stock.quantity} / {stock.maxStock} sticks
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary">
                    <div
                      className={`h-2 rounded-full ${
                        stock.quantity <= minStockThreshold
                          ? "bg-red-500"
                          : stock.quantity <= minStockThreshold * 2
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min((stock.quantity / stock.maxStock) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  {stock.quantity <= minStockThreshold && (
                    <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Stock is below alert threshold
                    </div>
                  )}
                </div>
              )}

              {/* Threshold Settings */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="minStockThreshold">
                    Low Stock Alert Threshold (sticks)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Alert will be triggered when stock falls below this number
                  </p>
                  <Input
                    id="minStockThreshold"
                    type="number"
                    min="0"
                    max={maxStock}
                    value={minStockThreshold}
                    onChange={(e) => setMinStockThreshold(e.target.value)}
                    disabled={!isAdmin}
                    className="max-w-[200px]"
                  />
                </div>

                <div>
                  <Label htmlFor="maxStock">Maximum Stock Capacity (sticks)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Maximum number of sticks this machine can hold
                  </p>
                  <Input
                    id="maxStock"
                    type="number"
                    min="1"
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                    disabled={!isAdmin}
                    className="max-w-[200px]"
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-lg border bg-blue-50/50 border-blue-200">
                <h4 className="text-sm font-medium text-blue-800 mb-1">
                  How Stock Alerts Work
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>
                    - When stock drops below <strong>{minStockThreshold} sticks</strong>,
                    a low stock alert will be triggered
                  </li>
                  <li>
                    - When stock reaches <strong>0</strong>, an immediate SLA breach
                    incident will be created
                  </li>
                  <li>
                    - Ops team will receive push notifications for all stock alerts
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {!isAdmin && (
            <div className="p-4 rounded-lg border bg-yellow-50/50 border-yellow-200">
              <p className="text-sm text-yellow-800">
                Only admin users can modify these settings.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
