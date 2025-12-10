"use client";

import { ClipboardList, Search, Download, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const mockOrders = [
  { id: "ORD-001", deviceId: "852259", product: "Sugarcane Juice", amount: 3.80, status: "completed", date: "2024-01-15 14:32" },
  { id: "ORD-002", deviceId: "852283", product: "Sugarcane Juice", amount: 3.80, status: "completed", date: "2024-01-15 14:28" },
  { id: "ORD-003", deviceId: "852259", product: "Sugarcane Juice", amount: 3.80, status: "refunded", date: "2024-01-15 14:15" },
  { id: "ORD-004", deviceId: "852277", product: "Sugarcane Juice", amount: 3.80, status: "completed", date: "2024-01-15 14:10" },
  { id: "ORD-005", deviceId: "852309", product: "Sugarcane Juice", amount: 3.80, status: "failed", date: "2024-01-15 14:05" },
  { id: "ORD-006", deviceId: "852279", product: "Sugarcane Juice", amount: 3.80, status: "completed", date: "2024-01-15 13:55" },
];

export default function OrderListPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Order List</h1>
          <p className="text-sm text-muted-foreground">View all transactions</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </header>

      <main className="p-6">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search orders..." className="pl-10" />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">{order.id}</TableCell>
                    <TableCell>{order.deviceId}</TableCell>
                    <TableCell>{order.product}</TableCell>
                    <TableCell>SGD {order.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "completed"
                            ? "success"
                            : order.status === "refunded"
                            ? "warning"
                            : "destructive"
                        }
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
