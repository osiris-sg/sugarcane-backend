"use client";

import { Monitor, Search, Plus, Filter } from "lucide-react";
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

// Mock equipment data
const mockEquipment = [
  { id: "852259", name: "Pacman Sentosa Event 259", status: "online", location: "Sentosa", lastSync: "2 min ago" },
  { id: "852283", name: "Pacman Sentosa Event 283", status: "online", location: "Sentosa", lastSync: "5 min ago" },
  { id: "852286", name: "Pacman Sentosa Event 286", status: "offline", location: "Sentosa", lastSync: "1 hour ago" },
  { id: "852277", name: "Pacman Sentosa Event 277", status: "online", location: "Sentosa", lastSync: "1 min ago" },
  { id: "852279", name: "Pacman Sentosa Event 279", status: "online", location: "Sentosa", lastSync: "3 min ago" },
  { id: "852309", name: "Pacman Sentosa Event 309", status: "online", location: "Sentosa", lastSync: "30 sec ago" },
];

export default function EquipmentListPage() {
  const onlineCount = mockEquipment.filter(e => e.status === "online").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Equipment List</h1>
          <p className="text-sm text-muted-foreground">
            {onlineCount} of {mockEquipment.length} devices online
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Equipment
        </Button>
      </header>

      <main className="p-6">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search equipment..." className="pl-10" />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Equipment Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockEquipment.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-mono">{device.id}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>
                      <Badge variant={device.status === "online" ? "success" : "destructive"}>
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{device.location}</TableCell>
                    <TableCell className="text-muted-foreground">{device.lastSync}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">View</Button>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </TableCell>
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
