"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;
const REQUIRED_CLEANINGS = 3;

// Helper to format date/time
function formatDateTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Compliance badge
function ComplianceBadge({ isCompliant, count }) {
  if (isCompliant) {
    return (
      <Badge className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        {count}/{REQUIRED_CLEANINGS}
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800">
      <XCircle className="h-3 w-3 mr-1" />
      {count}/{REQUIRED_CLEANINGS}
    </Badge>
  );
}

export default function CleaningLogsPage() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";

  const [compliance, setCompliance] = useState(null);
  const [logs, setLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [viewMode, setViewMode] = useState("compliance"); // compliance, logs
  const [currentPage, setCurrentPage] = useState(1);

  // Log dialog
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");

  // Get current month/year in Singapore time
  const now = new Date();
  const sgTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const currentMonth = sgTime.getMonth() + 1;
  const currentYear = sgTime.getFullYear();
  const monthName = sgTime.toLocaleString("en-SG", { month: "long" });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setRefreshing(true);
      const [complianceRes, logsRes, devicesRes] = await Promise.all([
        fetch(`/api/cleaning/compliance?month=${currentMonth}&year=${currentYear}`),
        fetch(`/api/cleaning/log?month=${currentMonth}&year=${currentYear}&limit=100`),
        fetch("/api/admin/devices"),
      ]);

      const complianceData = await complianceRes.json();
      const logsData = await logsRes.json();
      const devicesData = await devicesRes.json();

      if (complianceData.success) {
        setCompliance(complianceData);
      }
      if (logsData.logs) {
        setLogs(logsData.logs);
      }
      if (devicesData.devices) {
        setDevices(devicesData.devices);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  function openLogDialog() {
    setSelectedDevice("");
    setLogDialogOpen(true);
  }

  async function handleLogCleaning() {
    if (!selectedDevice) {
      toast.error("Please select a device");
      return;
    }

    setActionLoading(true);
    try {
      const device = devices.find((d) => d.deviceId === selectedDevice);
      const res = await fetch("/api/cleaning/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDevice,
          deviceName: device?.deviceName || selectedDevice,
          userId: user?.id,
          userName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Cleaning logged for ${device?.deviceName || selectedDevice}`);
        setLogDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || "Failed to log cleaning");
      }
    } catch (error) {
      toast.error("Failed to log cleaning");
    } finally {
      setActionLoading(false);
    }
  }

  // Pagination for compliance view
  const deviceList = compliance?.devices || [];
  const { totalItems, totalPages, getPageItems } = usePagination(deviceList, ITEMS_PER_PAGE);
  const paginatedDevices = getPageItems(currentPage);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Cleaning Logs</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              {monthName} {currentYear} - {REQUIRED_CLEANINGS} cleanings required per device
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="logs">Log History</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={openLogDialog}>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Log Cleaning</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Total Devices</span>
              </div>
              <p className="text-2xl font-bold">{compliance?.summary?.totalDevices || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Compliant</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {compliance?.summary?.compliantCount || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Non-Compliant</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {compliance?.summary?.nonCompliantCount || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Rate */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Compliance Rate</span>
              <span className="font-bold">
                {compliance?.summary?.complianceRate?.toFixed(1) || 0}%
              </span>
            </div>
            <Progress value={compliance?.summary?.complianceRate || 0} className="h-3" />
          </CardContent>
        </Card>

        {/* Compliance View */}
        {viewMode === "compliance" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Device Compliance Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cleanings</TableHead>
                    <TableHead>Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deviceList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No devices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedDevices.map((device) => (
                      <TableRow key={device.deviceId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{device.deviceName}</div>
                            <div className="text-xs text-muted-foreground">{device.deviceId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ComplianceBadge
                            isCompliant={device.isCompliant}
                            count={device.cleaningCount}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(device.cleaningCount / REQUIRED_CLEANINGS) * 100}
                              className="h-2 w-20"
                            />
                            <span className="text-sm">{device.cleaningCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {device.remaining > 0 ? (
                            <Badge variant="outline">{device.remaining} more needed</Badge>
                          ) : (
                            <span className="text-green-600 text-sm">Complete</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Logs View */}
        {viewMode === "logs" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cleaning Log History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Cleaned By</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No cleaning logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.deviceName}</div>
                            <div className="text-xs text-muted-foreground">{log.deviceId}</div>
                          </div>
                        </TableCell>
                        <TableCell>{log.userName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(log.loggedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Log Cleaning Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Cleaning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Device</label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.deviceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 inline mr-1" />
              This will be logged for {monthName} {currentYear}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogCleaning} disabled={actionLoading || !selectedDevice}>
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Log Cleaning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
