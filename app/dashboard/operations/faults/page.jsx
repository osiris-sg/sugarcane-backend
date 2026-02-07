"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Info,
  RefreshCw,
  Filter,
  X,
  ChevronDown,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Calendar,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Priority badge component
function PriorityBadge({ priority }) {
  if (priority === 3) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        High
      </Badge>
    );
  }
  if (priority === 2) {
    return (
      <Badge variant="warning" className="gap-1 bg-yellow-100 text-yellow-800">
        <Bell className="h-3 w-3" />
        Medium
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Info className="h-3 w-3" />
      Low
    </Badge>
  );
}

// Status badge component
function StatusBadge({ status }) {
  const variants = {
    OPEN: { variant: "destructive", label: "Open" },
    CHECKING: { variant: "warning", label: "Checking", className: "bg-yellow-100 text-yellow-800" },
    RESOLVED: { variant: "success", label: "Resolved" },
    UNRESOLVED: { variant: "secondary", label: "Unresolved" },
  };
  const config = variants[status] || variants.OPEN;
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

export default function FaultsPage() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";

  const [issues, setIssues] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Lazy loading state
  const [totalIssues, setTotalIssues] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sorting - server-side
  const [sortKey, setSortKey] = useState("triggeredAt");
  const [sortDirection, setSortDirection] = useState("desc");

  // Filters
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Date filter
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("00:00");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customEndTime, setCustomEndTime] = useState("23:59");

  // Build API URL with all params
  function buildApiUrl(offset = 0) {
    const params = new URLSearchParams();
    params.set("offset", offset.toString());
    params.set("limit", BATCH_SIZE.toString());
    params.set("sortBy", sortKey);
    params.set("sortDir", sortDirection);

    // Add date range filter
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case "today":
        params.set("startDate", todayStart.toISOString());
        break;
      case "week":
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        params.set("startDate", weekStart.toISOString());
        break;
      case "month":
        const monthStart = new Date(todayStart);
        monthStart.setDate(monthStart.getDate() - 30);
        params.set("startDate", monthStart.toISOString());
        break;
      case "custom":
        if (customStartDate) {
          params.set("startDate", new Date(`${customStartDate}T${customStartTime || "00:00"}:00+08:00`).toISOString());
        }
        if (customEndDate) {
          if (customEndTime && customEndTime !== "23:59") {
            params.set("endDate", new Date(`${customEndDate}T${customEndTime}:00+08:00`).toISOString());
          } else {
            const endDate = new Date(`${customEndDate}T00:00:00+08:00`);
            endDate.setDate(endDate.getDate() + 1);
            params.set("endDate", endDate.toISOString());
          }
        }
        break;
    }

    return `/api/maintenance/issue?${params.toString()}`;
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Re-fetch when sort or date range changes
  useEffect(() => {
    if (!loading && dateRange !== "custom") {
      fetchIssuesWithSort();
    }
  }, [sortKey, sortDirection, dateRange]);

  async function fetchData() {
    try {
      const [issuesRes, devicesRes] = await Promise.all([
        fetch(buildApiUrl(0)),
        fetch("/api/admin/devices"),
      ]);

      const issuesData = await issuesRes.json();
      const devicesData = await devicesRes.json();

      if (issuesData.issues) {
        setIssues(issuesData.issues);
        setTotalIssues(issuesData.total || issuesData.issues.length);
        setHasMore(issuesData.hasMore ?? false);
      }
      if (devicesData.devices) {
        setDevices(devicesData.devices);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Fetch issues with current filters (used when sort/date changes)
  async function fetchIssuesWithSort() {
    try {
      setRefreshing(true);
      const res = await fetch(buildApiUrl(0));
      const data = await res.json();

      if (data.issues) {
        setIssues(data.issues);
        setTotalIssues(data.total || data.issues.length);
        setHasMore(data.hasMore ?? false);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
    } finally {
      setRefreshing(false);
    }
  }

  // Handle custom date apply button
  function handleCustomDateApply() {
    fetchIssuesWithSort();
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

  // Fetch more issues silently when needed
  async function fetchMoreIssues() {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const offset = issues.length;
      const res = await fetch(buildApiUrl(offset));
      const data = await res.json();

      if (data.issues && data.issues.length > 0) {
        // Merge with existing issues, avoiding duplicates
        setIssues(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const newIssues = data.issues.filter(i => !existingIds.has(i.id));
          return [...prev, ...newIssues];
        });
        setTotalIssues(data.total || issues.length + data.issues.length);
        setHasMore(data.hasMore ?? false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more issues:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  function clearFilters() {
    setPriorityFilter("all");
    setStatusFilter("all");
    setDeviceFilter("all");
    setSearchText("");
    setDateRange("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setCustomStartTime("00:00");
    setCustomEndTime("23:59");
  }

  async function handleResolve(issueId, resolution) {
    setActionLoading(issueId);
    try {
      const res = await fetch(`/api/maintenance/issue/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", resolution }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Fault marked as ${resolution}`);
        fetchData();
      } else {
        toast.error(data.error || "Failed to update fault");
      }
    } catch (error) {
      console.error("Error resolving fault:", error);
      toast.error("Failed to update fault");
    } finally {
      setActionLoading(null);
    }
  }

  // Filter issues
  const filteredIssues = issues.filter((issue) => {
    // Priority filter
    if (priorityFilter !== "all" && issue.priority !== parseInt(priorityFilter)) {
      return false;
    }
    // Status filter
    if (statusFilter !== "all" && issue.status !== statusFilter) {
      return false;
    }
    // Device filter
    if (deviceFilter !== "all" && issue.deviceId !== deviceFilter) {
      return false;
    }
    // Search text
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        issue.deviceName?.toLowerCase().includes(search) ||
        issue.deviceId?.toLowerCase().includes(search) ||
        issue.faultCode?.toLowerCase().includes(search) ||
        issue.faultName?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Count by priority
  const priorityCounts = {
    high: issues.filter((i) => i.priority === 3).length,
    medium: issues.filter((i) => i.priority === 2).length,
    low: issues.filter((i) => i.priority === 1).length,
  };

  // Get unique devices from issues
  const uniqueDevices = [...new Map(issues.map((i) => [i.deviceId, { id: i.deviceId, name: i.deviceName }])).values()];

  // Pagination (data is already sorted from server)
  const { totalItems, totalPages, getPageItems } = usePagination(filteredIssues, ITEMS_PER_PAGE);
  const paginatedIssues = getPageItems(currentPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [priorityFilter, statusFilter, deviceFilter, searchText]);

  // Fetch more issues when approaching the end of loaded data
  useEffect(() => {
    if (!hasMore || loadingMore) return;

    // Calculate if we need more data based on current page
    const maxPageWithCurrentData = Math.ceil(issues.length / ITEMS_PER_PAGE);
    const pagesUntilEnd = maxPageWithCurrentData - currentPage;

    // If we're within 2 pages of the end of loaded data, fetch more
    if (pagesUntilEnd <= 2) {
      fetchMoreIssues();
    }
  }, [currentPage, issues.length, hasMore, loadingMore]);

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
            <h1 className="text-lg md:text-xl font-semibold">Fault Management</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">View and manage all device faults</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 md:h-9" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 md:mr-2 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Summary Cards */}
        <div className="mb-4 md:mb-6 grid grid-cols-3 gap-2 md:gap-4">
          <Card
            className={`cursor-pointer transition-colors ${priorityFilter === "3" ? "ring-2 ring-red-500" : ""}`}
            onClick={() => setPriorityFilter(priorityFilter === "3" ? "all" : "3")}
          >
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-2">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
                </div>
                <span className="font-medium text-xs md:text-sm">High</span>
              </div>
              <span className="text-xl md:text-2xl font-bold">{priorityCounts.high}</span>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${priorityFilter === "2" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setPriorityFilter(priorityFilter === "2" ? "all" : "2")}
          >
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-2">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-yellow-100">
                  <Bell className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
                </div>
                <span className="font-medium text-xs md:text-sm">Medium</span>
              </div>
              <span className="text-xl md:text-2xl font-bold">{priorityCounts.medium}</span>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${priorityFilter === "1" ? "ring-2 ring-blue-500" : ""}`}
            onClick={() => setPriorityFilter(priorityFilter === "1" ? "all" : "1")}
          >
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-2">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-blue-100">
                  <Info className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                </div>
                <span className="font-medium text-xs md:text-sm">Low</span>
              </div>
              <span className="text-xl md:text-2xl font-bold">{priorityCounts.low}</span>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Filters */}
        <Card className="mb-4 md:mb-6 hidden md:block">
          <CardHeader className="pb-3 px-4 md:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <Input
                placeholder="Search by device, fault code..."
                className="w-64"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="1">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CHECKING">Checking</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {uniqueDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name || device.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={(v) => {
                setDateRange(v);
                if (v !== "custom") {
                  setCustomStartDate("");
                  setCustomEndDate("");
                }
              }}>
                <SelectTrigger className="w-40">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {dateRange === "custom" && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      className="w-[150px]"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                    <Input
                      type="time"
                      className="w-[120px]"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                    />
                  </div>
                  <span className="text-muted-foreground text-sm">to</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      className="w-[150px]"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                    <Input
                      type="time"
                      className="w-[120px]"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCustomDateApply}
                    disabled={refreshing || (!customStartDate && !customEndDate)}
                  >
                    Apply
                  </Button>
                </div>
              )}

              {(priorityFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || dateRange !== "all" || searchText) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}

              <span className="ml-auto text-sm text-muted-foreground">
                Showing {filteredIssues.length} of {totalIssues} total faults
                {hasMore && ` (${totalIssues - issues.length} more)`}
                {loadingMore && " - loading..."}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Filters */}
        <div className="md:hidden mb-4">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {(priorityFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || dateRange !== "all" || searchText) && (
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <Input
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="1">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="CHECKING">Checking</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {uniqueDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name || device.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(v) => {
                setDateRange(v);
                if (v !== "custom") {
                  setCustomStartDate("");
                  setCustomEndDate("");
                }
              }}>
                <SelectTrigger>
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              {dateRange === "custom" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10">From</span>
                    <Input
                      type="date"
                      className="flex-1"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                    <Input
                      type="time"
                      className="w-24"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10">To</span>
                    <Input
                      type="date"
                      className="flex-1"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                    <Input
                      type="time"
                      className="w-24"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleCustomDateApply}
                    disabled={refreshing || (!customStartDate && !customEndDate)}
                  >
                    Apply Date Range
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between">
                {(priorityFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || dateRange !== "all" || searchText) && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-1 h-4 w-4" />
                    Clear
                  </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredIssues.length} of {totalIssues} total
                  {hasMore && ` (+${totalIssues - issues.length})`}
                  {loadingMore && " loading..."}
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Faults Table - Desktop */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="priority" label="Priority" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="deviceName" label="Device" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="faultCode" label="Fault Code" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="faultName" label="Fault Name" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="type" label="Type" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="status" label="Status" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="triggeredAt" label="Triggered" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="resolvedAt" label="Resolved At" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="py-8 text-center text-muted-foreground">
                      No faults found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedIssues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <PriorityBadge priority={issue.priority} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{issue.deviceName}</div>
                          <div className="text-xs text-muted-foreground">{issue.deviceId}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{issue.faultCode || "-"}</TableCell>
                      <TableCell>{issue.faultName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {issue.type === "DEVICE_ERROR" ? "Device Error" : "Zero Sales"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={issue.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(issue.triggeredAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(issue.resolvedAt)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {(issue.status === "OPEN" || issue.status === "CHECKING") ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoading === issue.id}
                                >
                                  {actionLoading === issue.id ? (
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
                                <DropdownMenuItem
                                  onClick={() => handleResolve(issue.id, "resolved")}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Resolved
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleResolve(issue.id, "unresolved")}
                                  className="text-red-600"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Mark Unresolved
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      )}
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

        {/* Faults Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {filteredIssues.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No faults found
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedIssues.map((issue) => (
                <Card key={issue.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{issue.deviceName}</p>
                        <p className="text-xs text-muted-foreground">{issue.deviceId}</p>
                      </div>
                      <PriorityBadge priority={issue.priority} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={issue.status} />
                      <Badge variant="outline" className="text-xs">
                        {issue.type === "DEVICE_ERROR" ? "Device Error" : "Zero Sales"}
                      </Badge>
                    </div>
                    <div className="text-xs space-y-1">
                      {issue.faultCode && (
                        <p><span className="text-muted-foreground">Code:</span> <span className="font-mono">{issue.faultCode}</span></p>
                      )}
                      {issue.faultName && (
                        <p><span className="text-muted-foreground">Fault:</span> {issue.faultName}</p>
                      )}
                      <p><span className="text-muted-foreground">Triggered:</span> {formatDateTime(issue.triggeredAt)}</p>
                      {issue.resolvedAt && (
                        <p><span className="text-muted-foreground">Resolved:</span> {formatDateTime(issue.resolvedAt)}</p>
                      )}
                    </div>
                    {isAdmin && (issue.status === "OPEN" || issue.status === "CHECKING") && (
                      <div className="flex gap-2 pt-2 border-t mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                          disabled={actionLoading === issue.id}
                          onClick={() => handleResolve(issue.id, "resolved")}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                          disabled={actionLoading === issue.id}
                          onClick={() => handleResolve(issue.id, "unresolved")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Unresolved
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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
    </div>
  );
}
