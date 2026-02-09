"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Smartphone, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DeviceRegistrationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hardwareId = searchParams.get("hardwareId");

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  async function fetchDevices() {
    try {
      setLoading(true);
      // Fetch devices that don't have a terminalId set yet (unregistered)
      const res = await fetch("/api/admin/devices");
      const data = await res.json();

      if (data.devices) {
        // Filter to show devices without terminalId or all devices for flexibility
        setDevices(data.devices);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!hardwareId) {
      toast.error("Hardware ID is missing");
      return;
    }

    if (!selectedDeviceId) {
      toast.error("Please select a device");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/device/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hardwareId,
          deviceId: selectedDeviceId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        toast.success("Device registered successfully!");
      } else {
        toast.error(data.error || "Failed to register device");
      }
    } catch (error) {
      console.error("Error registering device:", error);
      toast.error("Failed to register device");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hardwareId) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-30 border-b bg-background shrink-0">
          <div className="flex h-14 md:h-16 items-center px-4 md:px-6">
            <h1 className="text-lg md:text-xl font-semibold">Device Registration</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
                <h2 className="text-lg font-semibold mb-2">No Hardware ID</h2>
                <p className="text-muted-foreground">
                  This page requires a hardware ID parameter. Please access this page from a device registration notification.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-30 border-b bg-background shrink-0">
          <div className="flex h-14 md:h-16 items-center px-4 md:px-6">
            <h1 className="text-lg md:text-xl font-semibold">Device Registration</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h2 className="text-lg font-semibold mb-2">Registration Successful!</h2>
                <p className="text-muted-foreground mb-4">
                  The device has been registered successfully. The machine will now use the assigned device ID.
                </p>
                <Button onClick={() => router.push("/dashboard/operations")}>
                  Back to Operations
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Device Registration</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Link hardware to a device ID
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>New Device Detected</CardTitle>
                  <CardDescription>
                    Are you installing a new app into a machine?
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Hardware ID Display */}
                <div className="space-y-2">
                  <Label>Hardware ID (Build.SERIAL)</Label>
                  <Input
                    value={hardwareId}
                    readOnly
                    className="bg-muted font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the hardware serial number detected from the machine
                  </p>
                </div>

                {/* Device Selection */}
                <div className="space-y-2">
                  <Label htmlFor="deviceId">Select Device ID</Label>
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Select
                      value={selectedDeviceId}
                      onValueChange={setSelectedDeviceId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a device..." />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            <div className="flex flex-col">
                              <span>{device.location || device.deviceName}</span>
                              <span className="text-xs text-muted-foreground">
                                {device.deviceId}
                                {device.terminalId && ` (current: ${device.terminalId})`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Select the device ID that this machine should be linked to
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !selectedDeviceId}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Registering...
                    </>
                  ) : (
                    "Register Device"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mt-4">
            <CardContent className="pt-4">
              <h3 className="font-medium mb-2">What happens next?</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• The hardware ID will be linked to the selected device</li>
                <li>• The machine will automatically use this device ID</li>
                <li>• All future reports will be associated with this device</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
