"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  AlertTriangle,
  Bell,
  Info,
  Zap,
  Package,
  RefreshCw,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Helper to format relative time
function formatLastSeen(dateString) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec} sec ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

export default function OperationsPage() {
  const { user } = useUser();

  const [devices, setDevices] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Fetch devices and issues in parallel
      const [devicesRes, issuesRes] = await Promise.all([
        fetch("/api/admin/devices"),
        fetch("/api/maintenance/issue?status=OPEN,CHECKING"),
      ]);

      const devicesData = await devicesRes.json();
      const issuesData = await issuesRes.json();

      if (devicesData.devices) {
        setDevices(devicesData.devices);
      }

      if (issuesData.issues) {
        setIssues(issuesData.issues);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  // Calculate alert counts by priority
  const alertCounts = {
    high: issues.filter((i) => i.priority === 3).length,
    medium: issues.filter((i) => i.priority === 2).length,
    low: issues.filter((i) => i.priority === 1).length,
  };

  // Calculate active devices (using isActive boolean from Device table)
  const activeDevices = devices.filter((d) => d.isActive).length;

  // Get devices with lowest stock (using cupStock as percentage)
  const devicesWithStock = devices
    .filter((d) => d.cupStock !== null)
    .sort((a, b) => a.cupStock - b.cupStock)
    .slice(0, 3);

  // Filter devices by search text
  const filteredDevices = devices.filter(
    (d) =>
      d.deviceId.toLowerCase().includes(filterText.toLowerCase()) ||
      (d.deviceName && d.deviceName.toLowerCase().includes(filterText.toLowerCase()))
  );

  if (loading) {
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
        <div>
          <h1 className="text-xl font-semibold">Operations Overview</h1>
          <p className="text-sm text-muted-foreground">Real-time overview of all vending units</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/sales/equipment">
            <Button variant="default" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
          {/* Left Panel - Alerts & Stats */}
          <div className="space-y-4">
            {/* Priority Alerts */}
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <span className="font-medium">High Priority</span>
                </div>
                <span className="text-2xl font-bold">{alertCounts.high}</span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                    <Bell className="h-5 w-5 text-yellow-600" />
                  </div>
                  <span className="font-medium">Medium Priority</span>
                </div>
                <span className="text-2xl font-bold">{alertCounts.medium}</span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-medium">Low Priority</span>
                </div>
                <span className="text-2xl font-bold">{alertCounts.low}</span>
              </CardContent>
            </Card>

            {/* Active Units */}
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="font-medium">Active Units</span>
                </div>
                <span className="text-2xl font-bold">
                  {activeDevices} <span className="text-lg text-muted-foreground">/ {devices.length}</span>
                </span>
              </CardContent>
            </Card>

            {/* Lowest Stock */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Lowest Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {devicesWithStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stock data available</p>
                ) : (
                  devicesWithStock.map((device) => (
                    <div key={device.deviceId} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground hover:text-foreground cursor-pointer hover:underline truncate max-w-[180px]">
                        {device.deviceName || device.deviceId}
                      </span>
                      <span
                        className={
                          device.cupStock < 25
                            ? "text-red-500 font-medium"
                            : device.cupStock < 50
                            ? "text-yellow-500 font-medium"
                            : ""
                        }
                      >
                        {device.stockQuantity}/{device.stockMax} ({device.cupStock}%)
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Map */}
          <Card className="min-h-[400px]">
            <CardContent className="flex h-full items-center justify-center p-6">
              <div className="text-center text-muted-foreground">
                <div className="mb-4 text-6xl">🗺️</div>
                <p>Google Maps integration</p>
                <p className="text-sm">Device locations will appear here</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device Table */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Input
                placeholder="Filter by ID or name..."
                className="max-w-xs"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">
                {filteredDevices.length} device{filteredDevices.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Temp (°C)</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No devices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => {
                    return (
                      <TableRow key={device.deviceId}>
                        <TableCell className="font-medium">{device.deviceId}</TableCell>
                        <TableCell>{device.deviceName || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Link href={`/dashboard/sales/equipment/${device.id}`}>
                              <Button size="sm" variant="default">
                                View
                              </Button>
                            </Link>
                            <Link href={`/dashboard/sales/equipment/${device.id}`}>
                              <Button size="sm" variant="outline">
                                Edit
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={device.isActive ? "success" : "destructive"}>
                            {device.isActive ? "ON" : "OFF"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {device.stockQuantity !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 rounded-full bg-secondary">
                                <div
                                  className={`h-2 rounded-full ${
                                    device.cupStock < 25
                                      ? "bg-red-500"
                                      : device.cupStock < 50
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                  }`}
                                  style={{ width: `${Math.min(device.cupStock, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm">{device.stockQuantity}/{device.stockMax} ({device.cupStock}%)</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {device.refrigerationTemp !== null ? (
                            <div className="text-sm">
                              <span className={device.refrigerationTemp > 10 ? "text-red-500 font-medium" : ""}>
                                {device.refrigerationTemp?.toFixed(1)}
                              </span>
                              {device.machineTemp !== null && (
                                <span className="text-muted-foreground"> / {device.machineTemp?.toFixed(1)}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatLastSeen(device.lastSeenAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
