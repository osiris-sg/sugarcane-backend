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
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;

export default function DeviceListPage() {
  const { user } = useUser();
  const router = useRouter();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin" || role === "finance";

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [historyDialog, setHistoryDialog] = useState({ open: false, deviceId: null, deviceName: "" });
  const [locationHistory, setLocationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort("deviceId", "asc");

  useEffect(() => {
    fetchDevices();
  }, []);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
      device.deviceName?.toLowerCase().includes(search) ||
      device.location?.toLowerCase().includes(search)
    );
  });

  // Sort filtered devices
  const sortedDevices = sortData(filteredDevices, {
    getNestedValue: (item, key) => {
      if (key === "groupName") {
        // Sort by concatenated group names
        return item.allGroups?.map(g => g.name).join(", ") || "";
      }
      return item[key];
    },
  });

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(sortedDevices, ITEMS_PER_PAGE);
  const paginatedDevices = getPageItems(currentPage);

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

  const handleDelete = async (deviceId, deviceName) => {
    if (!confirm(`Are you sure you want to delete "${deviceName}" (${deviceId})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/devices?deviceId=${deviceId}&adminKey=${process.env.NEXT_PUBLIC_ADMIN_KEY || 'sugarcane123'}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDevices(devices.filter((d) => d.deviceId !== deviceId));
      } else {
        alert(data.error || "Failed to delete device");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      alert("Failed to delete device");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Device List</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {activeCount} of {devices.length} active
          </p>
        </div>
        <Button size="sm" onClick={() => router.push("/dashboard/sales/equipment/add")}>
          <Plus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Add</span>
        </Button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden p-4 md:p-6">
        {/* Filters */}
        <div className="mb-4 shrink-0">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Device Table - Desktop */}
        <Card className="hidden md:flex md:flex-col flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <TableRow>
                      <SortableTableHead column="deviceId" label="Id" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHead column="tid" label="TID" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHead column="deviceName" label="Name" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHead column="location" label="Location" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      {isAdmin && <SortableTableHead column="groupName" label="Group" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />}
                      <SortableTableHead column="isActive" label="Actived" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHead column="price" label="Price" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHead column="createdAt" label="Create Time" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableTableHead column="updatedAt" label="Timestamp" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDevices.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isAdmin ? 10 : 9}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No devices found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedDevices.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell className="font-mono">{device.deviceId}</TableCell>
                          <TableCell className="font-mono">{device.tid || "-"}</TableCell>
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
                            <TableCell>
                              {device.allGroups?.length > 0
                                ? device.allGroups.map(g => g.name).join(", ")
                                : "-"}
                            </TableCell>
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
                                onClick={() => handleDelete(device.deviceId, device.deviceName)}
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
              </div>
              {totalPages > 1 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </Card>

        {/* Device Cards - Mobile */}
        <div className="md:hidden flex flex-col flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto space-y-3">
                {paginatedDevices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No devices found
                  </div>
                ) : (
                  paginatedDevices.map((device) => (
                    <Card key={device.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{device.deviceName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{device.deviceId}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${device.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {device.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground mb-3">
                          <div className="flex items-center justify-between">
                            <span>Location:</span>
                            <div className="flex items-center gap-1">
                              <span>{device.location || "-"}</span>
                              <button
                                onClick={() => fetchLocationHistory(device.deviceId, device.deviceName)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <History className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center justify-between">
                              <span>Group:</span>
                              <span>
                                {device.allGroups?.length > 0
                                  ? device.allGroups.map(g => g.name).join(", ")
                                  : "-"}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span>Price:</span>
                            <span className="font-medium text-foreground">{formatPrice(device.price)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                            onClick={() => router.push(`/dashboard/sales/equipment/${device.id}`)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 bg-red-500 text-white hover:bg-red-600 border-red-500"
                            onClick={() => handleDelete(device.deviceId, device.deviceName)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
              {totalPages > 1 && (
                <div className="shrink-0 mt-3">
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
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
