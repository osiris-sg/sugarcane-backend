"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  RotateCcw,
  Calendar,
  Monitor,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Helper to get date range based on filter
function getDateRange(dateRange) {
  const now = new Date();
  let days = 7;
  switch (dateRange) {
    case "24h": days = 1; break;
    case "7d": days = 7; break;
    case "30d": days = 30; break;
    case "90d": days = 90; break;
    default: days = 7;
  }
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  return { startDate, endDate: now, days };
}

function MiniLineChart({ data, color = "#22c55e", height = 40 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaymentStatusBar({ succeeded, refunded, failed, total }) {
  const succeededWidth = (succeeded / total) * 100;
  const refundedWidth = (refunded / total) * 100;
  const failedWidth = (failed / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${succeededWidth}%` }}
        />
        <div
          className="bg-yellow-500 transition-all"
          style={{ width: `${refundedWidth}%` }}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${failedWidth}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-sm md:gap-4">
        <div className="flex items-center gap-1.5 md:gap-2">
          <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
          <span className="text-muted-foreground text-xs md:text-sm">Succeeded</span>
          <span className="font-medium text-xs md:text-sm">{succeeded}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4 text-yellow-500" />
          <span className="text-muted-foreground text-xs md:text-sm">Refunded</span>
          <span className="font-medium text-xs md:text-sm">{refunded}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />
          <span className="text-muted-foreground text-xs md:text-sm">Failed</span>
          <span className="font-medium text-xs md:text-sm">{failed}</span>
        </div>
      </div>
    </div>
  );
}

export default function SalesOverviewPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [interval, setInterval] = useState("daily");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [salesData, setSalesData] = useState({
    grossVolume: { amount: 0, change: 0, isPositive: true, data: [] },
    netVolume: { amount: 0, change: 0, isPositive: true, data: [] },
    payments: { succeeded: 0, refunded: 0, failed: 0, total: 0 },
    dailyData: [],
  });

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [dateRange, selectedDevice]);

  async function fetchDevices() {
    try {
      const res = await fetch("/api/admin/devices");
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  }

  async function fetchSalesData() {
    setLoading(true);
    try {
      const { startDate, endDate, days } = getDateRange(dateRange);

      // Build query params
      const params = new URLSearchParams({
        period: "custom",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (selectedDevice !== "all") {
        params.set("deviceId", selectedDevice);
      }

      // Fetch current period orders
      const res = await fetch(`/api/admin/orders?${params.toString()}&limit=10000`);
      const data = await res.json();

      if (data.success) {
        const orders = data.orders || [];

        // Calculate gross volume (total successful sales)
        const grossAmount = orders.reduce((sum, o) => sum + (o.amount || 0), 0);

        // Group orders by date for chart
        const dailyTotals = {};
        orders.forEach(order => {
          const date = new Date(order.createdAt).toISOString().split('T')[0];
          if (!dailyTotals[date]) {
            dailyTotals[date] = 0;
          }
          dailyTotals[date] += order.amount || 0;
        });

        // Create array of daily data for chart (last N days)
        const chartData = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          chartData.push(dailyTotals[dateStr] || 0);
        }

        // Fetch previous period for comparison
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - days);
        const prevParams = new URLSearchParams({
          period: "custom",
          startDate: prevStartDate.toISOString(),
          endDate: startDate.toISOString(),
        });
        if (selectedDevice !== "all") {
          prevParams.set("deviceId", selectedDevice);
        }

        const prevRes = await fetch(`/api/admin/orders?${prevParams.toString()}&limit=10000`);
        const prevData = await prevRes.json();
        const prevOrders = prevData.orders || [];
        const prevGrossAmount = prevOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        // Calculate change percentage
        let changePercent = 0;
        if (prevGrossAmount > 0) {
          changePercent = ((grossAmount - prevGrossAmount) / prevGrossAmount) * 100;
        } else if (grossAmount > 0) {
          changePercent = 100;
        }

        setSalesData({
          grossVolume: {
            amount: grossAmount / 100, // Convert cents to dollars
            change: Math.abs(changePercent).toFixed(1),
            isPositive: changePercent >= 0,
            data: chartData.map(v => v / 100), // Convert to dollars
          },
          netVolume: {
            amount: grossAmount / 100, // Same as gross for now (no refunds tracked)
            change: Math.abs(changePercent).toFixed(1),
            isPositive: changePercent >= 0,
            data: chartData.map(v => v / 100),
          },
          payments: {
            succeeded: orders.length,
            refunded: 0,
            failed: 0,
            total: orders.length,
          },
          dailyData: chartData,
        });
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background md:top-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Sales Analytics</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Track revenue, payments, and customer activity
            </p>
          </div>
        </div>

        {/* Mobile Filter Toggle */}
        <div className="md:hidden border-t bg-muted/30 px-4 py-2">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    {devices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.deviceName || device.deviceId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={compareEnabled ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setCompareEnabled(!compareEnabled)}
                >
                  Compare
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:flex items-center gap-4 border-t bg-muted/30 px-6 py-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.deviceName || device.deviceId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={compareEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setCompareEnabled(!compareEnabled)}
          >
            Compare to previous
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-6">
        {/* Top Row - Payments and Volume */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Payments */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Payments</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <PaymentStatusBar {...salesData.payments} />
            </CardContent>
          </Card>

          {/* Gross Volume */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Gross Volume</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold">
                  ${salesData.grossVolume.amount.toLocaleString("en-SG", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                {salesData.grossVolume.change > 0 && (
                  <span
                    className={`flex items-center text-xs md:text-sm ${
                      salesData.grossVolume.isPositive
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {salesData.grossVolume.isPositive ? (
                      <TrendingUp className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                    )}
                    {salesData.grossVolume.change}%
                  </span>
                )}
              </div>
              <div className="mt-3 md:mt-4">
                {salesData.grossVolume.data.length > 0 ? (
                  <MiniLineChart
                    data={salesData.grossVolume.data}
                    color={salesData.grossVolume.isPositive ? "#22c55e" : "#ef4444"}
                    height={32}
                  />
                ) : (
                  <div className="h-8 flex items-center justify-center text-xs md:text-sm text-muted-foreground">
                    No data
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Net Volume */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Net Volume</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold">
                  ${salesData.netVolume.amount.toLocaleString("en-SG", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                {salesData.netVolume.change > 0 && (
                  <span
                    className={`flex items-center text-xs md:text-sm ${
                      salesData.netVolume.isPositive
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {salesData.netVolume.isPositive ? (
                      <TrendingUp className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                    )}
                    {salesData.netVolume.change}%
                  </span>
                )}
              </div>
              <div className="mt-3 md:mt-4">
                {salesData.netVolume.data.length > 0 ? (
                  <MiniLineChart
                    data={salesData.netVolume.data}
                    color={salesData.netVolume.isPositive ? "#22c55e" : "#ef4444"}
                    height={32}
                  />
                ) : (
                  <div className="h-8 flex items-center justify-center text-xs md:text-sm text-muted-foreground">
                    No data
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="mt-4 md:mt-6 grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Failed Payments */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Failed Payments</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-3">
                <p className="text-xs md:text-sm text-muted-foreground">
                  No failed payments tracked
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Orders by Payment Method */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold">
                  {salesData.payments.succeeded}
                </span>
                <span className="text-xs md:text-sm text-muted-foreground">total orders</span>
              </div>
              <p className="mt-2 text-xs md:text-sm text-muted-foreground">
                Cash & card payments combined
              </p>
            </CardContent>
          </Card>

          {/* Top Devices */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">
                Selected Device
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-3">
                {selectedDevice === "all" ? (
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Showing all devices. Select a specific device to see details.
                  </p>
                ) : (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="font-medium text-sm md:text-base">
                      {devices.find(d => d.deviceId === selectedDevice)?.deviceName || selectedDevice}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {salesData.payments.succeeded} orders · ${salesData.grossVolume.amount.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Summary */}
        <Card className="mt-4 md:mt-6">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="text-sm md:text-base font-medium">Period Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Transactions</p>
                <p className="text-lg md:text-2xl font-bold">{salesData.payments.total}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Success Rate</p>
                <p className="text-lg md:text-2xl font-bold">
                  {salesData.payments.total > 0
                    ? ((salesData.payments.succeeded / salesData.payments.total) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Avg Order</p>
                <p className="text-lg md:text-2xl font-bold">
                  ${salesData.payments.succeeded > 0
                    ? (salesData.grossVolume.amount / salesData.payments.succeeded).toFixed(2)
                    : "0.00"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Total Cups</p>
                <p className="text-lg md:text-2xl font-bold">
                  {salesData.payments.succeeded}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
