"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  AlertCircle,
  RefreshCw,
  Filter,
  X,
  ChevronDown,
  Clock,
  CheckCircle,
  Play,
  Eye,
  Calendar,
  AlertTriangle,
  Bell,
  Info,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;
const BATCH_SIZE = 500;

// Helper to format date/time in Singapore timezone
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

// Format elapsed time
function formatElapsed(minutes) {
  if (!minutes && minutes !== 0) return "-";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

// Priority badge based on reminder count
function PriorityBadge({ reminderCount, slaOutcome }) {
  if (slaOutcome === "SLA_BREACHED") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Breached
      </Badge>
    );
  }
  if (reminderCount >= 2) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Final
      </Badge>
    );
  }
  if (reminderCount === 1) {
    return (
      <Badge className="gap-1 bg-yellow-100 text-yellow-800">
        <Bell className="h-3 w-3" />
        1st Reminder
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Info className="h-3 w-3" />
      Recent
    </Badge>
  );
}

// Status badge component
function StatusBadge({ status }) {
  const variants = {
    OPEN: { className: "bg-red-100 text-red-800", label: "Open" },
    ACKNOWLEDGED: { className: "bg-yellow-100 text-yellow-800", label: "Acknowledged" },
    IN_PROGRESS: { className: "bg-blue-100 text-blue-800", label: "In Progress" },
    RESOLVED: { className: "bg-green-100 text-green-800", label: "Resolved" },
  };
  const config = variants[status] || variants.OPEN;
  return <Badge className={config.className}>{config.label}</Badge>;
}

// Type badge component
function TypeBadge({ type }) {
  const labels = {
    ERROR_NOTIFICATION: "Device Error",
    OUT_OF_STOCK: "Out of Stock",
    ZERO_SALES: "Zero Sales",
    CLEANING_COMPLIANCE: "Cleaning",
    MANUAL_ERROR: "Manual",
  };
  return <Badge variant="outline">{labels[type] || type}</Badge>;
}

export default function IncidentsPage() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Lazy loading state
  const [totalIncidents, setTotalIncidents] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sorting - default: oldest first (longest elapsed time at top)
  const [sortKey, setSortKey] = useState("startTime");
  const [sortDirection, setSortDirection] = useState("asc");

  // Filters
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Resolve dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [resolution, setResolution] = useState("");
  const [resolutionCategory, setResolutionCategory] = useState("");

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);

  // Build API URL with all params
  function buildApiUrl(offset = 0) {
    const params = new URLSearchParams();
    params.set("offset", offset.toString());
    params.set("limit", BATCH_SIZE.toString());
    params.set("sortBy", sortKey);
    params.set("sortDir", sortDirection);

    if (statusFilter === "open") {
      params.set("status", "OPEN,ACKNOWLEDGED,IN_PROGRESS");
    } else if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (typeFilter !== "all") {
      params.set("type", typeFilter);
    }

    return `/api/incidents?${params.toString()}`;
  }

  useEffect(() => {
    fetchIncidents();
  }, []);

  // Re-fetch when sort or filters change
  useEffect(() => {
    if (!loading) {
      fetchIncidentsWithSort();
    }
  }, [sortKey, sortDirection, statusFilter, typeFilter]);

  async function fetchIncidents() {
    try {
      const res = await fetch(buildApiUrl(0));
      const data = await res.json();

      if (data.incidents) {
        setIncidents(data.incidents);
        setTotalIncidents(data.total || data.incidents.length);
        setHasMore(data.hasMore ?? false);
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
      toast.error("Failed to fetch incidents");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchIncidentsWithSort() {
    try {
      setRefreshing(true);
      const res = await fetch(buildApiUrl(0));
      const data = await res.json();

      if (data.incidents) {
        setIncidents(data.incidents);
        setTotalIncidents(data.total || data.incidents.length);
        setHasMore(data.hasMore ?? false);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setRefreshing(false);
    }
  }

  // Fetch more incidents when needed
  async function fetchMoreIncidents() {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const offset = incidents.length;
      const res = await fetch(buildApiUrl(offset));
      const data = await res.json();

      if (data.incidents && data.incidents.length > 0) {
        setIncidents(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const newIncidents = data.incidents.filter(i => !existingIds.has(i.id));
          return [...prev, ...newIncidents];
        });
        setTotalIncidents(data.total || incidents.length + data.incidents.length);
        setHasMore(data.hasMore ?? false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more incidents:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  // Handle sort click
  function handleSort(column) {
    if (column === sortKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(column);
      setSortDirection("desc");
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchIncidentsWithSort();
  }

  function clearFilters() {
    setStatusFilter("open");
    setTypeFilter("all");
    setPriorityFilter("all");
    setSearchText("");
  }

  async function handleAcknowledge(incidentId) {
    setActionLoading(incidentId);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Incident acknowledged");
        fetchIncidents();
      } else {
        toast.error(data.error || "Failed to acknowledge");
      }
    } catch (error) {
      toast.error("Failed to acknowledge incident");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStartProgress(incidentId) {
    setActionLoading(incidentId);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Status updated to In Progress");
        fetchIncidents();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setActionLoading(null);
    }
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
        fetchIncidents();
      } else {
        toast.error(data.error || "Failed to resolve");
      }
    } catch (error) {
      toast.error("Failed to resolve incident");
    } finally {
      setActionLoading(null);
    }
  }

  // Get priority level from reminder count
  function getPriorityLevel(incident) {
    if (incident.slaOutcome === "SLA_BREACHED") return 3;
    if (incident.reminderCount >= 2) return 3;
    if (incident.reminderCount === 1) return 2;
    return 1;
  }

  // Filter incidents
  const filteredIncidents = incidents.filter((incident) => {
    // Priority filter
    if (priorityFilter !== "all") {
      const level = getPriorityLevel(incident);
      if (priorityFilter === "final" && incident.reminderCount < 2) return false;
      if (priorityFilter === "first" && incident.reminderCount !== 1) return false;
      if (priorityFilter === "recent" && incident.reminderCount > 0) return false;
    }
    // Search
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        incident.deviceLocation?.toLowerCase().includes(search) ||
        incident.deviceName?.toLowerCase().includes(search) ||
        incident.deviceId?.toLowerCase().includes(search) ||
        incident.faultCode?.toLowerCase().includes(search) ||
        incident.faultName?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Count by priority
  const priorityCounts = {
    final: incidents.filter((i) => i.reminderCount >= 2 && i.status !== "RESOLVED").length,
    first: incidents.filter((i) => i.reminderCount === 1 && i.status !== "RESOLVED").length,
    recent: incidents.filter((i) => i.reminderCount === 0 && i.status !== "RESOLVED").length,
  };

  // Get unique devices from incidents
  const uniqueDevices = [...new Map(incidents.map((i) => [i.deviceId, { id: i.deviceId, name: i.deviceName }])).values()];

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(filteredIncidents, ITEMS_PER_PAGE);
  const paginatedIncidents = getPageItems(currentPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, priorityFilter, searchText]);

  // Lazy load more when approaching end of loaded data
  useEffect(() => {
    const currentEndItem = currentPage * ITEMS_PER_PAGE;
    const loadedItems = filteredIncidents.length;

    // If we're within 2 pages of the end and have more data to load
    if (hasMore && !loadingMore && currentEndItem + (ITEMS_PER_PAGE * 2) >= loadedItems) {
      fetchMoreIncidents();
    }
  }, [currentPage, filteredIncidents.length, hasMore, loadingMore]);

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
            <h1 className="text-lg md:text-xl font-semibold">Incidents</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Unified incident management with SLA tracking
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
        {/* Summary Cards - Priority based */}
        <div className="mb-4 md:mb-6 grid grid-cols-3 gap-2 md:gap-4">
          <Card
            className={`cursor-pointer transition-colors ${priorityFilter === "final" ? "ring-2 ring-orange-500" : ""}`}
            onClick={() => setPriorityFilter(priorityFilter === "final" ? "all" : "final")}
          >
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-2">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-orange-100">
                  <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                </div>
                <span className="font-medium text-xs md:text-sm">Final</span>
              </div>
              <span className="text-xl md:text-2xl font-bold">{priorityCounts.final}</span>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${priorityFilter === "first" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setPriorityFilter(priorityFilter === "first" ? "all" : "first")}
          >
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-2">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-yellow-100">
                  <Bell className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
                </div>
                <span className="font-medium text-xs md:text-sm">1st Reminder</span>
              </div>
              <span className="text-xl md:text-2xl font-bold">{priorityCounts.first}</span>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${priorityFilter === "recent" ? "ring-2 ring-blue-500" : ""}`}
            onClick={() => setPriorityFilter(priorityFilter === "recent" ? "all" : "recent")}
          >
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-2">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-blue-100">
                  <Info className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                </div>
                <span className="font-medium text-xs md:text-sm">Recent</span>
              </div>
              <span className="text-xl md:text-2xl font-bold">{priorityCounts.recent}</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4 md:mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search device, fault code..."
                className="w-full md:w-64"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ERROR_NOTIFICATION">Device Error</SelectItem>
                  <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                  <SelectItem value="ZERO_SALES">Zero Sales</SelectItem>
                  <SelectItem value="CLEANING_COMPLIANCE">Cleaning</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open (All)</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
              {(statusFilter !== "open" || typeFilter !== "all" || priorityFilter !== "all" || searchText) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
              <span className="ml-auto text-sm text-muted-foreground">
                {filteredIncidents.length} incidents
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Incidents Table - Desktop */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="reminderCount"
                    label="Priority"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="deviceName"
                    label="Device"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="type"
                    label="Type"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="faultName"
                    label="Fault Name"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="status"
                    label="Status"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="startTime"
                    label="Elapsed"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    column="startTime"
                    label="Started"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-muted-foreground">
                      No incidents found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedIncidents.map((incident) => {
                    const isCritical = incident.slaOutcome === "SLA_BREACHED" || incident.reminderCount >= 2;
                    const isWarning = incident.reminderCount === 1;

                    return (
                    <TableRow
                      key={incident.id}
                      className={
                        isCritical
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : isWarning
                            ? "bg-yellow-100 hover:bg-yellow-200"
                            : ""
                      }
                    >
                      <TableCell>
                        <PriorityBadge
                          reminderCount={incident.reminderCount}
                          slaOutcome={incident.slaOutcome}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{incident.deviceLocation || incident.deviceName}</div>
                          <div className={`text-xs ${isCritical ? "text-red-100" : "text-muted-foreground"}`}>{incident.deviceId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={incident.type} />
                      </TableCell>
                      <TableCell>
                        {incident.faultName ? (
                          <div>
                            <div className="text-sm">{incident.faultName}</div>
                            {incident.faultCode && (
                              <div className={`text-xs font-mono ${isCritical ? "text-red-100" : "text-muted-foreground"}`}>{incident.faultCode}</div>
                            )}
                          </div>
                        ) : (
                          <span className={isCritical ? "text-red-200" : "text-muted-foreground"}>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={incident.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatElapsed(incident.elapsedMinutes)}
                      </TableCell>
                      <TableCell className={`text-sm ${isCritical ? "text-red-100" : "text-muted-foreground"}`}>
                        {formatDateTime(incident.startTime)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {incident.status === "RESOLVED" ? (
                            <span className={`text-sm ${isCritical ? "text-red-200" : "text-muted-foreground"}`}>-</span>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoading === incident.id}
                                >
                                  {actionLoading === incident.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <MoreHorizontal className="h-4 w-4 md:mr-1" />
                                      <span className="hidden md:inline">Actions</span>
                                    </>
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {incident.status === "OPEN" && (
                                  <DropdownMenuItem onClick={() => handleAcknowledge(incident.id)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Acknowledge
                                  </DropdownMenuItem>
                                )}
                                {incident.status === "ACKNOWLEDGED" && (
                                  <DropdownMenuItem onClick={() => handleStartProgress(incident.id)}>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Progress
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openResolveDialog(incident)}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Resolve
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );})
                )}
              </TableBody>
            </Table>
            {loadingMore && (
              <div className="flex justify-center py-4 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more incidents...</span>
                </div>
              </div>
            )}
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

        {/* Incidents Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {filteredIncidents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No incidents found
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedIncidents.map((incident) => {
                const isCritical = incident.slaOutcome === "SLA_BREACHED" || incident.reminderCount >= 2;
                const isWarning = incident.reminderCount === 1;

                return (
                  <Card
                    key={incident.id}
                    className={
                      isCritical
                        ? "bg-red-600 text-white border-red-700"
                        : isWarning
                          ? "bg-yellow-50 border-yellow-200"
                          : ""
                    }
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{incident.deviceLocation || incident.deviceName}</span>
                            <PriorityBadge
                              reminderCount={incident.reminderCount}
                              slaOutcome={incident.slaOutcome}
                            />
                          </div>
                          <div className={`text-xs ${isCritical ? "text-red-200" : "text-muted-foreground"}`}>
                            {incident.deviceId}
                          </div>
                        </div>
                        {isAdmin && incident.status !== "RESOLVED" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant={isCritical ? "secondary" : "outline"}
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={actionLoading === incident.id}
                              >
                                {actionLoading === incident.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {incident.status === "OPEN" && (
                                <DropdownMenuItem onClick={() => handleAcknowledge(incident.id)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Acknowledge
                                </DropdownMenuItem>
                              )}
                              {incident.status === "ACKNOWLEDGED" && (
                                <DropdownMenuItem onClick={() => handleStartProgress(incident.id)}>
                                  <Play className="mr-2 h-4 w-4" />
                                  Start Progress
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openResolveDialog(incident)}
                                className="text-green-600"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Resolve
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <TypeBadge type={incident.type} />
                        <StatusBadge status={incident.status} />
                      </div>
                      {incident.faultName && (
                        <div className={`text-sm ${isCritical ? "text-red-100" : ""}`}>
                          {incident.faultName}
                          {incident.faultCode && (
                            <span className={`ml-1 font-mono text-xs ${isCritical ? "text-red-200" : "text-muted-foreground"}`}>
                              ({incident.faultCode})
                            </span>
                          )}
                        </div>
                      )}
                      <div className={`flex items-center justify-between text-xs ${isCritical ? "text-red-200" : "text-muted-foreground"}`}>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatElapsed(incident.elapsedMinutes)} elapsed
                        </span>
                        <span>{formatDateTime(incident.startTime)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                </div>
              )}
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
        </div>
      </main>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Device</p>
              <p className="text-sm text-muted-foreground">{selectedIncident?.deviceLocation || selectedIncident?.deviceName}</p>
            </div>
            {selectedIncident?.type === "ZERO_SALES" && (
              <div>
                <label className="text-sm font-medium">Resolution Category</label>
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
            )}
            <div>
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                className="mt-1"
                placeholder="Describe how the incident was resolved..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={actionLoading}>
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
