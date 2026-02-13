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
  MapPin,
  BarChart3,
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
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;

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
  const [currentPage, setCurrentPage] = useState(1);

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

  // Toggle zero sales alert for a device
  async function toggleZeroSalesAlert(deviceId, currentValue) {
    try {
      const res = await fetch(`/api/admin/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zeroSalesAlert: !currentValue }),
      });

      if (res.ok) {
        // Update local state
        setDevices(prev => prev.map(d =>
          d.deviceId === deviceId ? { ...d, zeroSalesAlert: !currentValue } : d
        ));
      }
    } catch (error) {
      console.error("Error toggling zero sales alert:", error);
    }
  }

  // Calculate alert counts by priority
  const alertCounts = {
    high: issues.filter((i) => i.priority === 3).length,
    medium: issues.filter((i) => i.priority === 2).length,
    low: issues.filter((i) => i.priority === 1).length,
  };

  // Calculate active devices (using isActive boolean from Device table)
  const activeDevices = devices.filter((d) => d.isActive).length;

  // Count unresponsive devices (active but no temp report for 10+ min)
  const unresponsiveDevices = devices.filter((d) => d.isUnresponsive).length;

  // Get devices with lowest stock (using cupStock as percentage)
  const devicesWithStock = devices
    .filter((d) => d.cupStock !== null)
    .sort((a, b) => a.cupStock - b.cupStock)
    .slice(0, 3);

  // Filter devices by search text
  const filteredDevices = devices
    .filter(
      (d) =>
        d.deviceId.toLowerCase().includes(filterText.toLowerCase()) ||
        (d.deviceName && d.deviceName.toLowerCase().includes(filterText.toLowerCase())) ||
        (d.location && d.location.toLowerCase().includes(filterText.toLowerCase()))
    )
    // Sort unresponsive devices to the top
    .sort((a, b) => {
      if (a.isUnresponsive && !b.isUnresponsive) return -1;
      if (!a.isUnresponsive && b.isUnresponsive) return 1;
      return 0;
    });

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(filteredDevices, ITEMS_PER_PAGE);
  const paginatedDevices = getPageItems(currentPage);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Operations Overview</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Real-time overview of all vending units</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 md:h-9" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 md:mr-2 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 md:gap-6 lg:grid-cols-[350px_1fr]">
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

            {/* Unresponsive Units */}
            {unresponsiveDevices > 0 && (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    </div>
                    <span className="font-medium text-orange-800">Unresponsive</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-600">{unresponsiveDevices}</span>
                </CardContent>
              </Card>
            )}

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
        <Card className="mt-4 md:mt-6">
          <CardHeader className="px-4 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                placeholder="Filter by ID, name, or location..."
                className="max-w-full sm:max-w-xs"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">
                {filteredDevices.length} device{filteredDevices.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Zero Sales</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Min Threshold</TableHead>
                    <TableHead>Temp (°C)</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        No devices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedDevices.map((device) => {
                      return (
                        <TableRow
                          key={device.deviceId}
                          className={device.isUnresponsive ? "bg-muted/50 opacity-60" : ""}
                        >
                          <TableCell className={`font-medium ${device.isUnresponsive ? "text-muted-foreground" : ""}`}>
                            {device.deviceId}
                          </TableCell>
                          <TableCell className={device.isUnresponsive ? "text-muted-foreground" : ""}>
                            {device.deviceName || "-"}
                          </TableCell>
                          <TableCell>
                            {device.location ? (
                              <div className="flex items-center gap-1.5 max-w-[200px]">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className={`truncate text-sm ${device.isUnresponsive ? "text-muted-foreground" : ""}`} title={device.location}>
                                  {device.location}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Link href={`/dashboard/sales/equipment/${device.id}`}>
                                <Button size="sm" variant="default">
                                  View
                                </Button>
                              </Link>
                              <Link href={`/dashboard/operations/machines/${device.id}`}>
                                <Button size="sm" variant="outline">
                                  Edit
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant={device.isActive ? "success" : "destructive"}>
                                {device.isActive ? "ON" : "OFF"}
                              </Badge>
                              {device.isUnresponsive && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                                  Unresponsive
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => toggleZeroSalesAlert(device.deviceId, device.zeroSalesAlert)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                device.zeroSalesAlert ? "bg-green-500" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  device.zeroSalesAlert ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
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
                            {device.storageQuantity !== null ? (
                              <span className="text-sm">{device.storageQuantity}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm ${device.stockQuantity !== null && device.stockQuantity <= device.minStockThreshold ? "text-red-500 font-medium" : ""}`}>
                              {device.minStockThreshold}
                            </span>
                          </TableCell>
                          <TableCell>
                            {device.machineTemp !== null ? (
                              <span className={device.machineTemp > 35 ? "text-red-500 font-medium" : "text-sm"}>
                                {device.machineTemp?.toFixed(1)}°
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatLastSeen(device.lastSeenAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {device.appVersion || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredDevices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No devices found</p>
              ) : (
                paginatedDevices.map((device) => (
                  <div
                    key={device.deviceId}
                    className={`rounded-lg border p-3 space-y-3 ${device.isUnresponsive ? "bg-muted/50 opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`font-medium text-sm ${device.isUnresponsive ? "text-muted-foreground" : ""}`}>
                          {device.deviceName || device.deviceId}
                        </p>
                        <p className="text-xs text-muted-foreground">{device.deviceId}</p>
                        {device.location && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {device.location}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={device.isActive ? "success" : "destructive"} className="text-xs">
                          {device.isActive ? "ON" : "OFF"}
                        </Badge>
                        {device.isUnresponsive && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">
                            Unresponsive
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Stock: </span>
                        {device.stockQuantity !== null ? (
                          <span className={
                            device.cupStock < 25 ? "text-red-500 font-medium" :
                            device.cupStock < 50 ? "text-yellow-500 font-medium" : ""
                          }>
                            {device.cupStock}%
                          </span>
                        ) : "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Storage: </span>
                        {device.storageQuantity !== null ? device.storageQuantity : "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Temp: </span>
                        {device.machineTemp !== null ? (
                          <span className={device.machineTemp > 35 ? "text-red-500 font-medium" : ""}>
                            {device.machineTemp?.toFixed(1)}°C
                          </span>
                        ) : "-"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatLastSeen(device.lastSeenAt)}</span>
                      <Link href={`/dashboard/sales/equipment/${device.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
              {totalPages > 1 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
