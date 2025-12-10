"use client";

export const dynamic = "force-dynamic";

import { AlertTriangle, Search, Filter } from "lucide-react";
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

const mockFaults = [
  { id: "FLT-001", deviceId: "852286", code: "E001", message: "Motor jam detected", severity: "high", status: "open", date: "2024-01-15 10:32" },
  { id: "FLT-002", deviceId: "852259", code: "W003", message: "Low stock warning", severity: "medium", status: "acknowledged", date: "2024-01-15 09:15" },
  { id: "FLT-003", deviceId: "852283", code: "I005", message: "Scheduled maintenance due", severity: "low", status: "open", date: "2024-01-14 18:00" },
  { id: "FLT-004", deviceId: "852277", code: "E002", message: "Payment terminal error", severity: "high", status: "resolved", date: "2024-01-14 14:22" },
];

export default function FaultLogPage() {
  const openFaults = mockFaults.filter(f => f.status === "open").length;
  const highPriority = mockFaults.filter(f => f.severity === "high" && f.status !== "resolved").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Fault Log</h1>
          <p className="text-sm text-muted-foreground">
            {openFaults} open faults, {highPriority} high priority
          </p>
        </div>
      </header>

      <main className="p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <span className="font-medium">High Priority</span>
              </div>
              <span className="text-2xl font-bold">{mockFaults.filter(f => f.severity === "high").length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <span className="font-medium">Medium Priority</span>
              </div>
              <span className="text-2xl font-bold">{mockFaults.filter(f => f.severity === "medium").length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-medium">Low Priority</span>
              </div>
              <span className="text-2xl font-bold">{mockFaults.filter(f => f.severity === "low").length}</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search faults..." className="pl-10" />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Faults Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fault ID</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFaults.map((fault) => (
                  <TableRow key={fault.id}>
                    <TableCell className="font-mono">{fault.id}</TableCell>
                    <TableCell>{fault.deviceId}</TableCell>
                    <TableCell className="font-mono">{fault.code}</TableCell>
                    <TableCell>{fault.message}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          fault.severity === "high"
                            ? "destructive"
                            : fault.severity === "medium"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {fault.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          fault.status === "resolved"
                            ? "success"
                            : fault.status === "acknowledged"
                            ? "warning"
                            : "outline"
                        }
                      >
                        {fault.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fault.date}</TableCell>
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
