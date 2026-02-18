"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import {
  TrendingDown,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Helper to format date/time in Singapore timezone
function formatTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Format elapsed time
function formatElapsed(startTime) {
  const now = new Date();
  const start = new Date(startTime);
  const minutes = Math.floor((now.getTime() - start.getTime()) / (60 * 1000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// Stage badge component
function StageBadge({ stage, startedAt }) {
  const elapsed = formatElapsed(startedAt);
  if (stage === 0) {
    return <Badge className="bg-yellow-100 text-yellow-800">Initial ({elapsed})</Badge>;
  }
  if (stage === 1) {
    return <Badge className="bg-orange-100 text-orange-800">30min+ ({elapsed})</Badge>;
  }
  return <Badge variant="destructive">Escalated ({elapsed})</Badge>;
}

export default function NoSalesPage() {
  const { isAdmin } = useUserRoles();

  const [stagingEntries, setStagingEntries] = useState([]);
  const [zeroSalesIncidents, setZeroSalesIncidents] = useState([]);
  const [deviceLocations, setDeviceLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Resolve dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [resolution, setResolution] = useState("");
  const [resolutionCategory, setResolutionCategory] = useState("");

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      // Fetch staging entries, zero sales incidents, and devices in parallel
      const [stagingRes, incidentsRes, devicesRes] = await Promise.all([
        fetch("/api/zero-sales/staging"),
        fetch("/api/incidents?type=ZERO_SALES&status=OPEN,ACKNOWLEDGED,IN_PROGRESS"),
        fetch("/api/admin/devices"),
      ]);

      const stagingData = await stagingRes.json();
      const incidentsData = await incidentsRes.json();
      const devicesData = await devicesRes.json();

      if (stagingData.entries) {
        setStagingEntries(stagingData.entries);
      }

      if (incidentsData.incidents) {
        setZeroSalesIncidents(incidentsData.incidents);
      }

      // Build device location map
      if (devicesData.devices) {
        const locationMap = {};
        devicesData.devices.forEach((device) => {
          locationMap[device.deviceId] = device.location || device.deviceName || device.deviceId;
        });
        setDeviceLocations(locationMap);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  function openResolveDialog(incident) {
    setSelectedIncident(incident);
    setResolution("");
    setResolutionCategory("");
    setResolveDialogOpen(true);
  }

  async function handleResolve() {
    if (!selectedIncident) return;

    setActionLoading(selectedIncident.id);
    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: resolution || "Resolved",
          resolutionCategory,
          userId: user?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Incident resolved");
        setResolveDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || "Failed to resolve");
      }
    } catch (error) {
      toast.error("Failed to resolve incident");
    } finally {
      setActionLoading(null);
    }
  }

  // Add non-passive touch listener for pull-to-refresh (needed for preventDefault)
  useEffect(() => {
    const handleTouchMoveNonPassive = (e) => {
      if (isPulling && window.scrollY <= 0 && pullDistance > 0) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMoveNonPassive, { passive: false });
    return () => document.removeEventListener('touchmove', handleTouchMoveNonPassive);
  }, [isPulling, pullDistance]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e) => {
    if (window.scrollY <= 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling) return;
    if (window.scrollY > 0) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, Math.min(100, currentY - pullStartY.current));
    setPullDistance(distance);
  }, [isPulling]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 60 && !refreshing) {
      handleRefresh();
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, refreshing]);

  // Get current time block
  const now = new Date();
  const sgTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const sgHour = sgTime.getHours();
  const timeBlocks = [
    { start: 9, end: 11, label: "9am-11am" },
    { start: 11, end: 13, label: "11am-1pm" },
    { start: 13, end: 15, label: "1pm-3pm" },
    { start: 15, end: 17, label: "3pm-5pm" },
    { start: 17, end: 19, label: "5pm-7pm" },
    { start: 19, end: 21, label: "7pm-9pm" },
    { start: 21, end: 23, label: "9pm-11pm" },
  ];
  const currentBlock = timeBlocks.find((b) => sgHour >= b.start && sgHour < b.end);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator - Mobile only */}
      <div className="md:hidden">
        {pullDistance > 0 && (
          <div
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-background border-b transition-all"
            style={{ height: pullDistance, opacity: Math.min(1, pullDistance / 40) }}
          >
            <RefreshCw className={`h-5 w-5 text-primary ${pullDistance > 60 ? 'animate-spin' : ''}`} />
            <span className="ml-2 text-sm text-muted-foreground">
              {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        )}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">No Sales Monitor</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Current block: {currentBlock?.label || "Outside operating hours"} | {sgHour >= 9 && sgHour < 23 ? "Active" : "Inactive"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 md:mr-2 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Summary */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">Staging</span>
              </div>
              <p className="text-2xl font-bold">{stagingEntries.length}</p>
              <p className="text-xs text-muted-foreground">Devices being monitored</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Incidents</span>
              </div>
              <p className="text-2xl font-bold">{zeroSalesIncidents.length}</p>
              <p className="text-xs text-muted-foreground">Escalated (60min+)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Escalated</span>
              </div>
              <p className="text-2xl font-bold">
                {zeroSalesIncidents.filter((i) => i.escalatedAt).length}
              </p>
              <p className="text-xs text-muted-foreground">To ops manager</p>
            </CardContent>
          </Card>
        </div>

        {/* Staging - Devices being monitored (0-60 min) */}
        {stagingEntries.length > 0 && (
          <>
            {/* Desktop Table */}
            <Card className="mb-6 hidden md:block">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Monitoring (0-60 min)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Time Block</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagingEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{deviceLocations[entry.deviceId] || entry.deviceName}</div>
                            <div className="text-xs text-muted-foreground">{entry.deviceId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.timeBlock || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <StageBadge stage={entry.stage} startedAt={entry.startedAt} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatElapsed(entry.startedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold">Monitoring (0-60 min)</span>
              </div>
              {stagingEntries.map((entry) => (
                <Card key={entry.id} className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{deviceLocations[entry.deviceId] || entry.deviceName}</div>
                        <div className="text-xs text-muted-foreground">{entry.deviceId}</div>
                      </div>
                      <StageBadge stage={entry.stage} startedAt={entry.startedAt} />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Block: {entry.timeBlock || "-"}</span>
                      <span>Duration: {formatElapsed(entry.startedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Zero Sales Incidents - Desktop Table */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Zero Sales Incidents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Time Block</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Stock</TableHead>
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {zeroSalesIncidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-muted-foreground">
                      No zero sales incidents
                    </TableCell>
                  </TableRow>
                ) : (
                  zeroSalesIncidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{deviceLocations[incident.deviceId] || incident.deviceName}</div>
                          <div className="text-xs text-muted-foreground">{incident.deviceId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{incident.timeBlock || "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        {incident.escalatedAt ? (
                          <Badge variant="destructive">Escalated</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">Monitoring</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatElapsed(incident.startTime)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {incident.stockQuantity || "-"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            disabled={actionLoading === incident.id}
                            onClick={() => openResolveDialog(incident)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Zero Sales Incidents - Mobile Cards */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5" />
            <span className="font-semibold">Zero Sales Incidents</span>
          </div>
          {zeroSalesIncidents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No zero sales incidents
              </CardContent>
            </Card>
          ) : (
            zeroSalesIncidents.map((incident) => (
              <Card
                key={incident.id}
                className={incident.escalatedAt ? "border-l-4 border-l-red-500" : "border-l-4 border-l-yellow-500"}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{deviceLocations[incident.deviceId] || incident.deviceName}</div>
                      <div className="text-xs text-muted-foreground">{incident.deviceId}</div>
                    </div>
                    {incident.escalatedAt ? (
                      <Badge variant="destructive">Escalated</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">Monitoring</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                    <span>Block: {incident.timeBlock || "-"}</span>
                    <span>Duration: {formatElapsed(incident.startTime)}</span>
                    <span>Stock: {incident.stockQuantity || "-"}</span>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-green-600"
                      disabled={actionLoading === incident.id}
                      onClick={() => openResolveDialog(incident)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Resolve
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Zero Sales Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Device</p>
              <p className="text-sm text-muted-foreground">{selectedIncident?.deviceName}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Resolution Category *</label>
              <Select value={resolutionCategory} onValueChange={setResolutionCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment_system_error">Payment System Error</SelectItem>
                  <SelectItem value="app_error">App Error</SelectItem>
                  <SelectItem value="power_off">Power Off</SelectItem>
                  <SelectItem value="location_issue">Location Issue</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                className="mt-1"
                placeholder="Describe what was found and how it was resolved..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={actionLoading || !resolutionCategory}
            >
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
