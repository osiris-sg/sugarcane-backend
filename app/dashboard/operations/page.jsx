"use client";

import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Info,
  Zap,
  Package,
  RefreshCw,
  Plus,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mock data - will be replaced with real data from API
const mockAlerts = {
  high: 2,
  medium: 5,
  low: 12,
};

const mockDevices = [
  { id: "852259", name: "Pacman Sentosa Event 259", status: "ON", stock: 85, lastSeen: "2 min ago" },
  { id: "852283", name: "Pacman Sentosa Event 283", status: "ON", stock: 45, lastSeen: "5 min ago" },
  { id: "852286", name: "Pacman Sentosa Event 286", status: "OFF", stock: 20, lastSeen: "1 hour ago" },
  { id: "852277", name: "Pacman Sentosa Event 277", status: "ON", stock: 60, lastSeen: "1 min ago" },
  { id: "852279", name: "Pacman Sentosa Event 279", status: "ON", stock: 15, lastSeen: "3 min ago" },
  { id: "852309", name: "Pacman Sentosa Event 309", status: "ON", stock: 90, lastSeen: "30 sec ago" },
];

const lowestStock = mockDevices
  .sort((a, b) => a.stock - b.stock)
  .slice(0, 3);

export default function OperationsPage() {
  const { user, isLoaded } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";

  // Redirect non-owners
  if (isLoaded && role !== "owner") {
    redirect("/dashboard");
  }

  const activeDevices = mockDevices.filter(d => d.status === "ON").length;
  const totalDevices = mockDevices.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Sugarcane Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time overview of all vending units</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Device
          </Button>
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" />
            Users Management
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
          {/* Left Panel - Alerts & Stats */}
          <div className="space-y-4">
            {/* Priority Alerts */}
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <span className="font-medium">High Priority</span>
                </div>
                <span className="text-2xl font-bold">{mockAlerts.high}</span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                    <Bell className="h-5 w-5 text-yellow-600" />
                  </div>
                  <span className="font-medium">Medium Priority</span>
                </div>
                <span className="text-2xl font-bold">{mockAlerts.medium}</span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-medium">Low Priority</span>
                </div>
                <span className="text-2xl font-bold">{mockAlerts.low}</span>
              </CardContent>
            </Card>

            {/* Active Units */}
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="font-medium">Active Units</span>
                </div>
                <span className="text-2xl font-bold">
                  {activeDevices} <span className="text-lg text-muted-foreground">/ {totalDevices}</span>
                </span>
              </CardContent>
            </Card>

            {/* Lowest Stock */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Lowest Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lowestStock.map((device) => (
                  <div key={device.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground hover:text-foreground cursor-pointer hover:underline">
                      {device.name}
                    </span>
                    <span className={device.stock < 25 ? "text-red-500 font-medium" : device.stock < 50 ? "text-yellow-500 font-medium" : ""}>
                      {device.stock}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Map */}
          <Card className="min-h-[400px]">
            <CardContent className="flex h-full items-center justify-center p-6">
              <div className="text-center text-muted-foreground">
                <div className="mb-4 text-6xl">🗺️</div>
                <p>Google Maps integration</p>
                <p className="text-sm">Device locations will appear here</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device Table */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Input
                placeholder="Filter by ID..."
                className="max-w-xs"
              />
              <Button variant="outline" size="sm">
                Columns
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.id}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default">View</Button>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={device.status === "ON" ? "success" : "destructive"}>
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-secondary">
                          <div
                            className={`h-2 rounded-full ${
                              device.stock < 25 ? "bg-red-500" :
                              device.stock < 50 ? "bg-yellow-500" : "bg-green-500"
                            }`}
                            style={{ width: `${device.stock}%` }}
                          />
                        </div>
                        <span className="text-sm">{device.stock}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{device.lastSeen}</TableCell>
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
