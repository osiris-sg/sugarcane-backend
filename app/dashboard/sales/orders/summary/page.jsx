"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { BarChart3, Calendar, Filter, Download, ChevronDown, ChevronRight, Users, Monitor } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function OrderSummaryPage() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";
  const roleLower = role?.toLowerCase();
  const isAdmin = roleLower === "owner" || roleLower === "admin";
  const isPartnerships = roleLower === "partnerships";
  const isFranchisee = roleLower === "franchisee";
  const hideGroupInfo = isPartnerships || isFranchisee;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("day");
  const [groupId, setGroupId] = useState("all");
  const [deviceId, setDeviceId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState(isAdmin ? "group" : "device"); // "device" or "group"
  const [expandedGroups, setExpandedGroups] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (groupId && groupId !== "all") params.set("groupId", groupId);
      if (deviceId && deviceId !== "all") params.set("deviceId", deviceId);
      if (period === "custom") {
        // Convert dates to SGT (UTC+8) ISO strings with exclusive end date
        if (startDate) {
          const start = new Date(startDate + "T00:00:00+08:00");
          params.set("startDate", start.toISOString());
        }
        if (endDate) {
          // Exclusive end date - use 00:00:00 of the selected date (like old platform)
          const end = new Date(endDate + "T00:00:00+08:00");
          params.set("endDate", end.toISOString());
        }
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

  // Count total devices per group (from all devices, not just those with orders)
  const deviceCountByGroup = data?.filters?.devices?.reduce((acc, device) => {
    const gId = device.groupId || "unassigned";
    acc[gId] = (acc[gId] || 0) + 1;
    return acc;
  }, {}) || {};

  // Aggregate data by franchisee group
  const groupedData = data?.summary?.reduce((acc, item) => {
    const gName = item.groupName || "Unassigned";
    const gId = item.groupId || "unassigned";

    if (!acc[gId]) {
      acc[gId] = {
        groupId: gId,
        groupName: gName,
        totalSales: 0,
        totalCups: 0,
        orderCount: 0,
        devices: [],
      };
    }

    acc[gId].totalSales += item.totalSales;
    acc[gId].totalCups += item.totalCups;
    acc[gId].orderCount += item.orderCount;
    acc[gId].devices.push(item);

    return acc;
  }, {}) || {};

  // Convert to array and sort by total sales (highest first)
  const groupedSummary = Object.values(groupedData).sort((a, b) => b.totalSales - a.totalSales);

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b bg-background px-4 md:px-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Order Summary</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
            Sales by {viewMode === "group" ? "franchisee group" : "device"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Tabs value={viewMode} onValueChange={setViewMode} className="hidden md:block">
              <TabsList className="h-8">
                <TabsTrigger value="device" className="text-xs px-2 h-6 gap-1">
                  <Monitor className="h-3 w-3" />
                  Device
                </TabsTrigger>
                <TabsTrigger value="group" className="text-xs px-2 h-6 gap-1">
                  <Users className="h-3 w-3" />
                  Group
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.summary?.length}>
            <Download className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Export CSV</span>
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Mobile Filters */}
        <div className="md:hidden">
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
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Period</label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-full">
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
                {!hideGroupInfo && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Group</label>
                    <Select value={groupId} onValueChange={(val) => { setGroupId(val); setDeviceId("all"); }}>
                      <SelectTrigger className="w-full">
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
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Device</label>
                <Select value={deviceId} onValueChange={setDeviceId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Devices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    {filteredDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.location || device.deviceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {period === "custom" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Start</label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">End</label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleCustomDateApply} size="sm" className="w-full">
                    Apply Dates
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Desktop Filters */}
        <Card className="hidden md:block">
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
              {!hideGroupInfo && (
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
              )}

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
                        {device.location || device.deviceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardHeader className="pb-1 md:pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Total Sales
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              {loading ? (
                <Skeleton className="h-6 md:h-8 w-16 md:w-24" />
              ) : (
                <div className="text-lg md:text-2xl font-bold">
                  {formatCurrency(data?.totals?.totalSales || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 md:pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Total Cups
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              {loading ? (
                <Skeleton className="h-6 md:h-8 w-16 md:w-24" />
              ) : (
                <div className="text-lg md:text-2xl font-bold">
                  {data?.totals?.totalCups || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 md:pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              {loading ? (
                <Skeleton className="h-6 md:h-8 w-16 md:w-24" />
              ) : (
                <div className="text-lg md:text-2xl font-bold">
                  {data?.totals?.totalOrders || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Table - Desktop */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sales by {viewMode === "group" ? "Franchisee Group" : "Device"}
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
            ) : viewMode === "group" ? (
              /* Group View - List Style */
              <div className="divide-y">
                {/* Summary Header Row */}
                <div className="flex items-center justify-between py-3 px-4 bg-muted/30">
                  <span className="font-semibold">
                    Order Summary({data?.summary?.length || 0})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="bg-red-500 text-white text-sm font-medium px-2.5 py-0.5 rounded-full">
                      {data?.totals?.totalCups || 0}
                    </span>
                    <span className="bg-red-500 text-white text-sm font-medium px-2.5 py-0.5 rounded-full">
                      {((data?.totals?.totalSales || 0) / 100).toFixed(1)}
                    </span>
                  </div>
                </div>
                {/* Group Rows */}
                {groupedSummary.map((group) => (
                  <div key={group.groupId}>
                    <div
                      className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleGroupExpand(group.groupId)}
                    >
                      <span className="font-medium">
                        {group.groupName}({deviceCountByGroup[group.groupId] || group.devices.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="bg-red-500 text-white text-sm font-medium px-2.5 py-0.5 rounded-full">
                          {group.totalCups}
                        </span>
                        <span className="bg-red-500 text-white text-sm font-medium px-2.5 py-0.5 rounded-full">
                          {(group.totalSales / 100).toFixed(1)}
                        </span>
                        {expandedGroups[group.groupId] ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {/* Expanded Devices */}
                    {expandedGroups[group.groupId] && (
                      <div className="bg-muted/20 divide-y">
                        {group.devices.map((device) => (
                          <div key={device.deviceId} className="flex items-center justify-between py-2 px-4 pl-8">
                            <div>
                              <span className="text-sm">{device.deviceName}</span>
                              <span className="text-xs text-muted-foreground ml-2">{device.deviceId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                {device.totalCups}
                              </span>
                              <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                {(device.totalSales / 100).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Device View Table (Original) */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    {!hideGroupInfo && <TableHead>Group</TableHead>}
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
                      {!hideGroupInfo && (
                        <TableCell>
                          {item.groupName || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
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
                      {!hideGroupInfo && <TableCell></TableCell>}
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

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Sales by {viewMode === "group" ? "Group" : "Device"}
            </div>
            {isAdmin && (
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList className="h-7">
                  <TabsTrigger value="device" className="text-xs px-2 h-5 gap-1">
                    <Monitor className="h-3 w-3" />
                  </TabsTrigger>
                  <TabsTrigger value="group" className="text-xs px-2 h-5 gap-1">
                    <Users className="h-3 w-3" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : data?.summary?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No orders found for the selected period
            </div>
          ) : viewMode === "group" ? (
            /* Group View - Mobile (List Style) */
            <Card>
              <CardContent className="p-0 divide-y">
                {/* Summary Header Row */}
                <div className="flex items-center justify-between py-3 px-3 bg-muted/30">
                  <span className="font-semibold text-sm">
                    Order Summary({data?.summary?.length || 0})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {data?.totals?.totalCups || 0}
                    </span>
                    <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {((data?.totals?.totalSales || 0) / 100).toFixed(1)}
                    </span>
                  </div>
                </div>
                {/* Group Rows */}
                {groupedSummary.map((group) => (
                  <div key={group.groupId}>
                    <div
                      className="flex items-center justify-between py-3 px-3 cursor-pointer"
                      onClick={() => toggleGroupExpand(group.groupId)}
                    >
                      <span className="font-medium text-sm">
                        {group.groupName}({deviceCountByGroup[group.groupId] || group.devices.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                          {group.totalCups}
                        </span>
                        <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                          {(group.totalSales / 100).toFixed(1)}
                        </span>
                        {expandedGroups[group.groupId] ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                        )}
                      </div>
                    </div>
                    {/* Expanded Devices */}
                    {expandedGroups[group.groupId] && (
                      <div className="bg-muted/20 divide-y">
                        {group.devices.map((device) => (
                          <div key={device.deviceId} className="flex items-center justify-between py-2 px-3 pl-6">
                            <span className="text-xs truncate max-w-[50%]">{device.deviceName}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="bg-gray-200 text-gray-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                                {device.totalCups}
                              </span>
                              <span className="bg-gray-200 text-gray-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                                {(device.totalSales / 100).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            /* Device View - Mobile */
            <>
              {data?.summary?.map((item) => (
                <Card key={item.deviceId}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{item.deviceName}</p>
                        {!hideGroupInfo && <p className="text-xs text-muted-foreground">{item.groupName || "-"}</p>}
                      </div>
                      <p className="text-lg font-bold">{formatCurrency(item.totalSales)}</p>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{item.totalCups} cups</span>
                      <span>{item.orderCount} orders</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
