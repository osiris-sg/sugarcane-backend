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

// Helper to format currency
function formatCurrency(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrderListPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [payWayFilter, setPayWayFilter] = useState("all");

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
  }

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (deviceFilter !== "all" && order.deviceId !== deviceFilter) {
      return false;
    }
    if (payWayFilter !== "all" && order.payWay !== payWayFilter) {
      return false;
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

  // Calculate stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => new Date(o.createdAt) >= todayStart);
  const todayTotal = todayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const todayCount = todayOrders.length;

  // Export to CSV
  function exportToCSV() {
    const headers = ["Order ID", "Device ID", "Device Name", "Amount", "Payment Method", "Quantity", "Date"];
    const rows = filteredOrders.map((o) => [
      o.orderId,
      o.deviceId,
      o.deviceName,
      (o.amount / 100).toFixed(2),
      o.payWay || "-",
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
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Order List</h1>
          <p className="text-sm text-muted-foreground">View all transactions</p>
        </div>
        <div className="flex items-center gap-2">
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

      <main className="p-6">
        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(todayTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Orders</p>
                  <p className="text-xl font-bold">{todayCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(monthlyTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <ShoppingCart className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Orders</p>
                  <p className="text-xl font-bold">{monthlyCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  className="pl-10"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-48">
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
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  {uniquePayWays.map((payWay) => (
                    <SelectItem key={payWay} value={payWay}>
                      {payWay}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchText || deviceFilter !== "all" || payWayFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}

              <span className="ml-auto text-sm text-muted-foreground">
                {filteredOrders.length} of {orders.length} orders
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
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
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
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
                            {order.payWay?.toLowerCase().includes("cash") ? (
                              <Banknote className="h-3 w-3" />
                            ) : (
                              <CreditCard className="h-3 w-3" />
                            )}
                            {order.payWay}
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
