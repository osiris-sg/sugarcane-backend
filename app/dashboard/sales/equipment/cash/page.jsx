"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Wallet, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function CashRecordsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payWayFilter, setPayWayFilter] = useState("all");
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);

  useEffect(() => {
    fetchOrders();
  }, [payWayFilter]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (payWayFilter !== "all") {
        params.set("payWay", payWayFilter);
      }
      params.set("limit", "100");

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders);
        setMonthlyTotal(data.monthlyTotal);
        setMonthlyCount(data.monthlyCount);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatAmount(cents) {
    return (cents / 100).toFixed(2);
  }

  function exportToCSV() {
    const headers = ["Date", "Order ID", "Device ID", "Amount (SGD)", "Payment Method", "Group"];
    const rows = orders.map((order) => [
      formatDate(order.createdAt),
      order.orderId,
      order.deviceId,
      formatAmount(order.amount),
      order.payWay || "N/A",
      order.groupName || "Ungrouped",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Sales Records</h1>
          <p className="text-sm text-muted-foreground">View all sales transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={payWayFilter} onValueChange={setPayWayFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Payment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="paynow">PayNow</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV} disabled={orders.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <main className="p-6">
        {/* Summary */}
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">SGD {formatAmount(monthlyTotal)}</p>
                <p className="text-xs text-muted-foreground">{monthlyCount} orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No orders found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Group</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                      <TableCell className="font-mono">{order.deviceId}</TableCell>
                      <TableCell className="font-medium">SGD {formatAmount(order.amount)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          order.payWay === "cash"
                            ? "bg-green-100 text-green-700"
                            : order.payWay === "card"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {order.payWay || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>{order.groupName || "Ungrouped"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
