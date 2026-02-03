"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";

export default function EditDevicePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin" || role === "finance";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const [addToPartnership, setAddToPartnership] = useState(false);
  const [device, setDevice] = useState({
    deviceId: "",
    deviceName: "",
    location: "",
    price: "",
    isActive: true,
    groupId: "",
    tid: "",
    fomoTid: "",
    allGroups: [],
  });

  useEffect(() => {
    fetchDevice();
    fetchGroups();
  }, [params.id]);

  const fetchDevice = async () => {
    try {
      const res = await fetch("/api/admin/devices");
      const data = await res.json();
      if (data.devices) {
        const found = data.devices.find((d) => d.id === params.id);
        if (found) {
          setDevice({
            deviceId: found.deviceId || "",
            deviceName: found.deviceName || "",
            location: found.location || "",
            price: found.price ? (found.price / 100).toFixed(2) : "",
            isActive: found.isActive,
            groupId: found.groupId || "",
            tid: found.tid || "",
            fomoTid: found.fomoTid || "",
            allGroups: found.allGroups || [],
          });
          // Check if already in partnership group
          const inPartnership = found.allGroups?.some(g =>
            g.name.toLowerCase() === "partnership" || g.name.toLowerCase() === "partnerships"
          );
          setAddToPartnership(inPartnership || false);
        }
      }
    } catch (error) {
      console.error("Error fetching device:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/admin/groups");
      const data = await res.json();
      if (data.groups) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find partnership group ID if checkbox is selected
      const partnershipGroup = groups.find(g =>
        g.name.toLowerCase() === "partnership" || g.name.toLowerCase() === "partnerships"
      );

      // Update device
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          location: device.location,
          price: Math.round(parseFloat(device.price) * 100),
          isActive: device.isActive,
          groupId: device.groupId || null,
          tid: device.tid || null,
          fomoTid: device.fomoTid || null,
          additionalGroupIds: addToPartnership && partnershipGroup ? [partnershipGroup.id] : [],
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/dashboard/sales/equipment");
      } else {
        alert("Error saving device: " + data.error);
      }
    } catch (error) {
      console.error("Error saving device:", error);
      alert("Error saving device");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/sales/equipment")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Edit Device</h1>
            <p className="text-sm text-muted-foreground">
              Device ID: {device.deviceId}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </header>

      <main className="p-6">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Device ID - Read only */}
              <div className="space-y-2">
                <Label htmlFor="deviceId">Device ID</Label>
                <Input
                  id="deviceId"
                  value={device.deviceId}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Device ID cannot be changed
                </p>
              </div>

              {/* TID */}
              <div className="space-y-2">
                <Label htmlFor="tid">TID</Label>
                <Input
                  id="tid"
                  value={device.tid}
                  onChange={(e) =>
                    setDevice({ ...device, tid: e.target.value })
                  }
                  placeholder="Enter TID"
                />
                <p className="text-xs text-muted-foreground">
                  Payment terminal identifier
                </p>
              </div>

              {/* FomoPay TID */}
              <div className="space-y-2">
                <Label htmlFor="fomoTid">FomoPay TID</Label>
                <Input
                  id="fomoTid"
                  value={device.fomoTid}
                  onChange={(e) =>
                    setDevice({ ...device, fomoTid: e.target.value })
                  }
                  placeholder="10000001"
                />
                <p className="text-xs text-muted-foreground">
                  FomoPay Terminal ID for QR payments (defaults to 10000001 if empty)
                </p>
              </div>

              {/* Device Name */}
              <div className="space-y-2">
                <Label htmlFor="deviceName">Name</Label>
                <Input
                  id="deviceName"
                  value={device.deviceName}
                  onChange={(e) =>
                    setDevice({ ...device, deviceName: e.target.value })
                  }
                  placeholder="Enter device name"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={device.location}
                  onChange={(e) =>
                    setDevice({ ...device, location: e.target.value })
                  }
                  placeholder="Enter location"
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Price (SGD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.10"
                  min="0"
                  value={device.price}
                  onChange={(e) =>
                    setDevice({ ...device, price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={device.isActive ? "active" : "inactive"}
                  onValueChange={(value) =>
                    setDevice({ ...device, isActive: value === "active" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Group - Only for admins */}
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="group">Group (Franchisee)</Label>
                  <Select
                    value={device.groupId || "none"}
                    onValueChange={(value) =>
                      setDevice({
                        ...device,
                        groupId: value === "none" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Group</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Also add to Partnership group */}
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="partnership"
                    checked={addToPartnership}
                    onCheckedChange={setAddToPartnership}
                  />
                  <Label htmlFor="partnership" className="text-sm font-normal cursor-pointer">
                    Also add to Partnership group
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
