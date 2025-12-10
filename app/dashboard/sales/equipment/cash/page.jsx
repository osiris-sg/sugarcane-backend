"use client";

import { Wallet, Download } from "lucide-react";
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

const mockCashRecords = [
  { id: 1, deviceId: "852259", date: "2024-01-15", amount: 245.00, collectedBy: "John" },
  { id: 2, deviceId: "852283", date: "2024-01-15", amount: 180.50, collectedBy: "John" },
  { id: 3, deviceId: "852277", date: "2024-01-14", amount: 320.00, collectedBy: "Sarah" },
  { id: 4, deviceId: "852309", date: "2024-01-14", amount: 156.00, collectedBy: "Sarah" },
];

export default function CashRecordsPage() {
  const totalCollected = mockCashRecords.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Cash Records</h1>
          <p className="text-sm text-muted-foreground">Track cash collections from devices</p>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Collected This Month</p>
                <p className="text-2xl font-bold">SGD {totalCollected.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Collected By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCashRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.date}</TableCell>
                    <TableCell className="font-mono">{record.deviceId}</TableCell>
                    <TableCell className="font-medium">SGD {record.amount.toFixed(2)}</TableCell>
                    <TableCell>{record.collectedBy}</TableCell>
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
