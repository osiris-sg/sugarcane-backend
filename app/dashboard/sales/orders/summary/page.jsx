"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { BarChart3, Calendar, Filter, Download } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderSummaryPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("day");
  const [groupId, setGroupId] = useState("all");
  const [deviceId, setDeviceId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (groupId && groupId !== "all") params.set("groupId", groupId);
      if (deviceId && deviceId !== "all") params.set("deviceId", deviceId);
      if (period === "custom") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }

      const res = await fetch(`/api/admin/orders/summary?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, groupId, deviceId]);

  const handleCustomDateApply = () => {
    if (period === "custom") {
      fetchData();
    }
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const exportCSV = () => {
    if (!data?.summary) return;

    const headers = ["Device ID", "Device Name", "Location", "Group", "Total Sales", "Total Cups", "Orders"];
    const rows = data.summary.map(item => [
      item.deviceId,
      item.deviceName,
      item.location || "",
      item.groupName || "",
      (item.totalSales / 100).toFixed(2),
      item.totalCups,
      item.orderCount,
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-summary-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Filter devices by selected group
  const filteredDevices = data?.filters?.devices?.filter(d =>
    groupId === "all" || d.groupId === groupId
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Order Summary</h1>
          <p className="text-sm text-muted-foreground">Sales by device</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.summary?.length}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </header>

      <main className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {/* Period Filter */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Period</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              {period === "custom" && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleCustomDateApply} size="sm">
                      Apply
                    </Button>
                  </div>
                </>
              )}

              {/* Group Filter */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Group</label>
                <Select value={groupId} onValueChange={(val) => { setGroupId(val); setDeviceId("all"); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {data?.filters?.groups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Device Filter */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Device</label>
                <Select value={deviceId} onValueChange={setDeviceId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Devices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    {filteredDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.deviceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(data?.totals?.totalSales || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {data?.totals?.totalCups || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {data?.totals?.totalOrders || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sales by Device
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.summary?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No orders found for the selected period
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Total Cups</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.summary?.map((item) => (
                    <TableRow key={item.deviceId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.deviceName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.deviceId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.groupName || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalSales)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.totalCups}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.orderCount}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  {data?.summary?.length > 1 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(data?.totals?.totalSales || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {data?.totals?.totalCups || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {data?.totals?.totalOrders || 0}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
