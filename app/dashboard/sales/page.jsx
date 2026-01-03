"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  ClipboardList,
  Search,
  Download,
  Filter,
  RefreshCw,
  X,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Banknote,
  Gift,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// Helper to format date/time in Singapore timezone
function formatDateTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Short date format for mobile
function formatDateShort(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Helper to format currency
function formatCurrency(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Map payWay codes to friendly names
function getPaymentMethod(payWay) {
  const payWayMap = {
    "2": { label: "Cashless", icon: "card" },
    "1000": { label: "Free", icon: "free" },
  };

  if (!payWay) return null;

  const mapped = payWayMap[String(payWay)];
  if (mapped) return mapped;

  // Fallback for unknown codes
  return { label: payWay, icon: "card" };
}

const ITEMS_PER_PAGE = 50;

export default function OrderListPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [payWayFilter, setPayWayFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all"); // all, today, week, month, custom
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const res = await fetch("/api/admin/orders?limit=500");
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders || []);
        setMonthlyTotal(data.monthlyTotal || 0);
        setMonthlyCount(data.monthlyCount || 0);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchOrders();
  }

  function clearFilters() {
    setSearchText("");
    setDeviceFilter("all");
    setPayWayFilter("all");
    setDateRange("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(1);
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, deviceFilter, payWayFilter, dateRange, customStartDate, customEndDate]);

  // Get date range boundaries
  function getDateRangeBounds() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case "today":
        return { start: todayStart, end: null };
      case "week":
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        return { start: weekStart, end: null };
      case "month":
        const monthStart = new Date(todayStart);
        monthStart.setDate(monthStart.getDate() - 30);
        return { start: monthStart, end: null };
      case "custom":
        return {
          start: customStartDate ? new Date(customStartDate) : null,
          end: customEndDate ? new Date(customEndDate + "T23:59:59") : null,
        };
      default:
        return { start: null, end: null };
    }
  }

  // Filter orders
  const { start: dateStart, end: dateEnd } = getDateRangeBounds();
  const filteredOrders = orders.filter((order) => {
    if (deviceFilter !== "all" && order.deviceId !== deviceFilter) {
      return false;
    }
    if (payWayFilter !== "all" && order.payWay !== payWayFilter) {
      return false;
    }
    // Date range filter
    if (dateStart || dateEnd) {
      const orderDate = new Date(order.createdAt);
      if (dateStart && orderDate < dateStart) return false;
      if (dateEnd && orderDate > dateEnd) return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        order.orderId?.toLowerCase().includes(search) ||
        order.deviceId?.toLowerCase().includes(search) ||
        order.deviceName?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Get unique devices and payment methods for filters
  const uniqueDevices = [...new Map(orders.map((o) => [o.deviceId, { id: o.deviceId, name: o.deviceName }])).values()];
  const uniquePayWays = [...new Set(orders.map((o) => o.payWay).filter(Boolean))];

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Calculate stats based on filtered orders (excluding free orders - payWay 1000)
  const paidFilteredOrders = filteredOrders.filter((o) => o.payWay !== "1000");
  const filteredTotal = paidFilteredOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const filteredCount = paidFilteredOrders.length;

  // Get label suffix based on active filters
  const getFilterLabel = () => {
    const parts = [];
    if (deviceFilter !== "all") {
      const device = uniqueDevices.find((d) => d.id === deviceFilter);
      parts.push(device?.name || deviceFilter);
    }
    if (dateRange === "today") parts.push("Today");
    else if (dateRange === "week") parts.push("Last 7 Days");
    else if (dateRange === "month") parts.push("Last 30 Days");
    else if (dateRange === "custom" && (customStartDate || customEndDate)) parts.push("Custom Range");

    return parts.length > 0 ? parts.join(" - ") : null;
  };

  const filterLabel = getFilterLabel();
  const hasFilters = deviceFilter !== "all" || payWayFilter !== "all" || dateRange !== "all" || searchText;

  // Export to CSV
  function exportToCSV() {
    const headers = ["Order ID", "Device ID", "Device Name", "Amount", "Payment Method", "Quantity", "Date"];
    const rows = filteredOrders.map((o) => [
      o.orderId,
      o.deviceId,
      o.deviceName,
      (o.amount / 100).toFixed(2),
      getPaymentMethod(o.payWay)?.label || "-",
      o.quantity || 1,
      new Date(o.createdAt).toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

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
      <header className="sticky top-0 z-30 border-b bg-background px-4 py-3 md:px-6 md:py-0 md:h-16 md:flex md:items-center md:justify-between">
        <div className="flex items-center justify-between md:block">
          <div>
            <h1 className="text-lg font-semibold md:text-xl">Order List</h1>
            <p className="text-xs text-muted-foreground md:text-sm">View all transactions</p>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={exportToCSV}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {/* Summary Cards */}
        <div className="mb-4 md:mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-green-100 shrink-0">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {hasFilters ? "Filtered" : "Total"}
                  </p>
                  <p className="text-base md:text-xl font-bold">{formatCurrency(filteredTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-blue-100 shrink-0">
                  <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {hasFilters ? "Filtered" : "Orders"}
                  </p>
                  <p className="text-base md:text-xl font-bold">{filteredCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-purple-100 shrink-0">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Monthly Rev</p>
                  <p className="text-base md:text-xl font-bold">{formatCurrency(monthlyTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-orange-100 shrink-0">
                  <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Monthly Ord</p>
                  <p className="text-base md:text-xl font-bold">{monthlyCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters - Collapsible on mobile */}
        <Card className="mb-4 md:mb-6">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer md:cursor-default" onClick={(e) => {
                // Only trigger collapse on mobile
                if (window.innerWidth >= 768) {
                  e.preventDefault();
                  setFiltersOpen(true);
                }
              }}>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasFilters && (
                      <Badge variant="secondary" className="ml-2">Active</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 md:hidden transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent className="md:block" forceMount>
              <CardContent className={`space-y-3 md:space-y-0 ${!filtersOpen ? "hidden md:block" : ""}`}>
                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      className="pl-10"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:flex md:gap-4">
                    <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Device" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Devices</SelectItem>
                        {uniqueDevices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name || device.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={payWayFilter} onValueChange={setPayWayFilter}>
                      <SelectTrigger className="w-full md:w-40">
                        <SelectValue placeholder="Payment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payments</SelectItem>
                        {uniquePayWays.map((payWay) => (
                          <SelectItem key={payWay} value={payWay}>
                            {getPaymentMethod(payWay)?.label || payWay}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Select value={dateRange} onValueChange={(v) => {
                    setDateRange(v);
                    if (v !== "custom") {
                      setCustomStartDate("");
                      setCustomEndDate("");
                    }
                  }}>
                    <SelectTrigger className="w-full md:w-40">
                      <Calendar className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {dateRange === "custom" && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Input
                        type="date"
                        className="flex-1 md:w-36"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        placeholder="Start date"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="date"
                        className="flex-1 md:w-36"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        placeholder="End date"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between md:ml-auto">
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-1 h-4 w-4" />
                        Clear
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground ml-auto">
                      {filteredOrders.length} of {orders.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Orders Table - Desktop */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="max-h-[calc(100vh-420px)] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.deviceName}</div>
                            <div className="text-xs text-muted-foreground">{order.deviceId}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(order.amount)}</TableCell>
                        <TableCell>
                          {order.payWay ? (
                            <Badge variant="outline" className="gap-1">
                              {getPaymentMethod(order.payWay)?.icon === "free" ? (
                                <Gift className="h-3 w-3" />
                              ) : getPaymentMethod(order.payWay)?.icon === "cash" ? (
                                <Banknote className="h-3 w-3" />
                              ) : (
                                <CreditCard className="h-3 w-3" />
                              )}
                              {getPaymentMethod(order.payWay)?.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{order.quantity || 1}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {/* Pagination - Desktop */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Orders List - Mobile (Card view) */}
        <div className="md:hidden space-y-3">
          {paginatedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No orders found
              </CardContent>
            </Card>
          ) : (
            paginatedOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{order.deviceName}</p>
                      <p className="text-xs text-muted-foreground">{order.deviceId}</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(order.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {order.payWay ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          {getPaymentMethod(order.payWay)?.icon === "free" ? (
                            <Gift className="h-3 w-3" />
                          ) : (
                            <CreditCard className="h-3 w-3" />
                          )}
                          {getPaymentMethod(order.payWay)?.label}
                        </Badge>
                      ) : null}
                      <span className="text-muted-foreground">x{order.quantity || 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateShort(order.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Pagination - Mobile */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
