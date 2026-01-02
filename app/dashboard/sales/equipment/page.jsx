"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Search, Plus, History, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DeviceListPage() {
  const { user } = useUser();
  const router = useRouter();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [historyDialog, setHistoryDialog] = useState({ open: false, deviceId: null, deviceName: "" });
  const [locationHistory, setLocationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/admin/devices");
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationHistory = async (deviceId, deviceName) => {
    setHistoryDialog({ open: true, deviceId, deviceName });
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/devices/${deviceId}/location-history`);
      const data = await res.json();
      if (data.success) {
        setLocationHistory(data.history);
      }
    } catch (error) {
      console.error("Error fetching location history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Format duration from milliseconds
  const formatDuration = (ms) => {
    if (!ms) return "Current";
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Filter devices by search term
  const filteredDevices = devices.filter((device) => {
    const search = searchTerm.toLowerCase();
    return (
      device.deviceId?.toLowerCase().includes(search) ||
      device.deviceName?.toLowerCase().includes(search)
    );
  });

  // Format price display (e.g., "$3.80")
  const formatPrice = (priceInCents) => {
    if (!priceInCents) return "-";
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-SG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const activeCount = devices.filter((d) => d.isActive).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Device List</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} of {devices.length} devices active
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/sales/equipment/add")}>
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </header>

      <main className="p-6">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Enter search content"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Device Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Id</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    {isAdmin && <TableHead>Group</TableHead>}
                    <TableHead>Actived</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Create Time</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 9 : 8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No devices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-mono">{device.deviceId}</TableCell>
                        <TableCell>{device.deviceName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{device.location || "-"}</span>
                            <button
                              onClick={() => fetchLocationHistory(device.deviceId, device.deviceName)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="View location history"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>{device.group?.name || "-"}</TableCell>
                        )}
                        <TableCell>
                          <span className={device.isActive ? "text-green-600" : "text-red-600"}>
                            {device.isActive ? "actived" : "inactive"}
                          </span>
                        </TableCell>
                        <TableCell>{formatPrice(device.price)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(device.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(device.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                              onClick={() => router.push(`/dashboard/sales/equipment/${device.id}`)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-red-500 text-white hover:bg-red-600 border-red-500"
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Location History Dialog */}
      <Dialog open={historyDialog.open} onOpenChange={(open) => setHistoryDialog({ ...historyDialog, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Location History - {historyDialog.deviceName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : locationHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No location history found</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {locationHistory.map((record, index) => (
                  <div
                    key={record.id}
                    className={`p-3 rounded-lg border ${index === 0 && !record.endedAt ? "bg-green-50 border-green-200" : "bg-muted/50"}`}
                  >
                    <p className="font-medium">{record.location}</p>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <p>
                        <span className="text-foreground/70">From:</span>{" "}
                        {new Date(record.startedAt).toLocaleString("en-SG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p>
                        <span className="text-foreground/70">To:</span>{" "}
                        {record.endedAt ? (
                          new Date(record.endedAt).toLocaleString("en-SG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        ) : (
                          <span className="text-green-600 font-medium">Present</span>
                        )}
                      </p>
                      {record.durationMs && (
                        <p className="text-xs mt-1">
                          Duration: {formatDuration(record.durationMs)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
