"use client";

export const dynamic = "force-dynamic";

import { RotateCcw, Search, Download } from "lucide-react";
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

const mockRefunds = [
  { id: "REF-001", orderId: "ORD-003", amount: 3.80, reason: "Machine error", status: "completed", date: "2024-01-15" },
  { id: "REF-002", orderId: "ORD-089", amount: 3.80, reason: "Product not dispensed", status: "pending", date: "2024-01-14" },
];

export default function RefundRecordsPage() {
  const totalRefunds = mockRefunds.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Refund Records</h1>
          <p className="text-sm text-muted-foreground">Track all refund transactions</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </header>

      <main className="p-6">
        {/* Summary */}
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                <RotateCcw className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Refunds This Month</p>
                <p className="text-2xl font-bold">SGD {totalRefunds.toFixed(2)}</p>
              </div>
            </div>
            <Badge variant="warning">{mockRefunds.length} refunds</Badge>
          </CardContent>
        </Card>

        {/* Refunds Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search refunds..." className="pl-10" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Refund ID</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRefunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-mono">{refund.id}</TableCell>
                    <TableCell className="font-mono">{refund.orderId}</TableCell>
                    <TableCell>SGD {refund.amount.toFixed(2)}</TableCell>
                    <TableCell>{refund.reason}</TableCell>
                    <TableCell>
                      <Badge variant={refund.status === "completed" ? "success" : "warning"}>
                        {refund.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{refund.date}</TableCell>
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
