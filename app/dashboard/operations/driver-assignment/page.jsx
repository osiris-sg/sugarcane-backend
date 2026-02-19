"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  Truck,
  Monitor,
  Search,
  User,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function DriverAssignmentPage() {
  const { isLoaded } = useUser();
  const { isAdmin, isLoaded: rolesLoaded } = useUserRoles();

  const [drivers, setDrivers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingDevices, setSavingDevices] = useState({});

  // Redirect non-admins
  if (isLoaded && rolesLoaded && !isAdmin) {
    redirect("/dashboard/operations");
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/driver-assignment");
      const data = await res.json();

      if (data.success) {
        setDrivers(data.drivers || []);
        // Get all devices with their assigned drivers
        const devicesRes = await fetch("/api/admin/devices");
        const devicesData = await devicesRes.json();
        if (devicesData.success) {
          // Merge driver assignment info into devices
          const allDevices = devicesData.devices || [];
          // Create a map of device assignments from drivers data
          const deviceDriverMap = {};
          data.drivers?.forEach((driver) => {
            driver.devices?.forEach((device) => {
              if (!deviceDriverMap[device.deviceId]) {
                deviceDriverMap[device.deviceId] = [];
              }
              deviceDriverMap[device.deviceId].push(driver.id);
            });
          });

          // Add assigned drivers to each device
          const devicesWithDrivers = allDevices.map((device) => ({
            ...device,
            assignedDriverIds: deviceDriverMap[device.deviceId] || [],
          }));
          setDevices(devicesWithDrivers);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const toggleDriverAssignment = async (deviceId, driverId, isCurrentlyAssigned) => {
    setSavingDevices((prev) => ({ ...prev, [deviceId + driverId]: true }));

    try {
      const res = await fetch("/api/admin/driver-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          driverId,
          action: isCurrentlyAssigned ? "unassign" : "assign",
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Update local state
        setDevices((prev) =>
          prev.map((device) => {
            if (device.deviceId === deviceId) {
              const newDriverIds = isCurrentlyAssigned
                ? device.assignedDriverIds.filter((id) => id !== driverId)
                : [...device.assignedDriverIds, driverId];
              return { ...device, assignedDriverIds: newDriverIds };
            }
            return device;
          })
        );
      } else {
        toast.error(data.error || "Failed to update assignment");
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to update assignment");
    } finally {
      setSavingDevices((prev) => ({ ...prev, [deviceId + driverId]: false }));
    }
  };

  const filteredDevices = devices.filter((d) => {
    const search = searchTerm.toLowerCase();
    return (
      d.deviceId?.toLowerCase().includes(search) ||
      d.deviceName?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search)
    );
  });

  // Group devices by whether they have assignments
  const assignedDevices = filteredDevices.filter((d) => d.assignedDriverIds.length > 0);
  const unassignedDevices = filteredDevices.filter((d) => d.assignedDriverIds.length === 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Driver Assignment</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {drivers.length} drivers, {devices.length} devices ({unassignedDevices.length} unassigned)
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {/* Driver Legend */}
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Drivers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm"
                >
                  {driver.imageUrl ? (
                    <img
                      src={driver.imageUrl}
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100">
                      <User className="h-3 w-3 text-orange-600" />
                    </div>
                  )}
                  <span>{driver.firstName} {driver.lastName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Devices List */}
        <div className="space-y-6">
          {/* Unassigned Devices Section */}
          {unassignedDevices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Unassigned Devices ({unassignedDevices.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unassignedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    drivers={drivers}
                    savingDevices={savingDevices}
                    onToggle={toggleDriverAssignment}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Assigned Devices Section */}
          {assignedDevices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Assigned Devices ({assignedDevices.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assignedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    drivers={drivers}
                    savingDevices={savingDevices}
                    onToggle={toggleDriverAssignment}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DeviceCard({ device, drivers, savingDevices, onToggle }) {
  return (
    <Card className={device.assignedDriverIds.length === 0 ? "border-destructive/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              {device.location || device.deviceName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              ID: {device.deviceId}
            </p>
          </div>
          <Badge variant={device.assignedDriverIds.length > 0 ? "secondary" : "destructive"}>
            {device.assignedDriverIds.length} driver{device.assignedDriverIds.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2">
          {drivers.map((driver) => {
            const isAssigned = device.assignedDriverIds.includes(driver.id);
            const isSaving = savingDevices[device.deviceId + driver.id];

            return (
              <label
                key={driver.id}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  isAssigned ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={() =>
                      onToggle(device.deviceId, driver.id, isAssigned)
                    }
                  />
                )}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {driver.imageUrl ? (
                    <img
                      src={driver.imageUrl}
                      alt=""
                      className="h-6 w-6 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 flex-shrink-0">
                      <User className="h-3 w-3 text-orange-600" />
                    </div>
                  )}
                  <span className="text-sm truncate">
                    {driver.firstName} {driver.lastName}
                  </span>
                </div>
                {isAssigned && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
