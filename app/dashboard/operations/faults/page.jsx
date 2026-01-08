"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Bell,
  Info,
  RefreshCw,
  Filter,
  X,
  ChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;

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
  const [issues, setIssues] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [issuesRes, devicesRes] = await Promise.all([
        fetch("/api/maintenance/issue"),
        fetch("/api/admin/devices"),
      ]);

      const issuesData = await issuesRes.json();
      const devicesData = await devicesRes.json();

      if (issuesData.issues) {
        setIssues(issuesData.issues);
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

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  function clearFilters() {
    setPriorityFilter("all");
    setStatusFilter("all");
    setDeviceFilter("all");
    setSearchText("");
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

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(filteredIssues, ITEMS_PER_PAGE);
  const paginatedIssues = getPageItems(currentPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [priorityFilter, statusFilter, deviceFilter, searchText]);

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

              {(priorityFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || searchText) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}

              <span className="ml-auto text-sm text-muted-foreground">
                {filteredIssues.length} of {issues.length} faults
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
                  {(priorityFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || searchText) && (
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
              <div className="flex items-center justify-between">
                {(priorityFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || searchText) && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-1 h-4 w-4" />
                    Clear
                  </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredIssues.length} of {issues.length} faults
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
                  <TableHead>Priority</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Fault Code</TableHead>
                  <TableHead>Fault Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Triggered</TableHead>
                  <TableHead>Resolved At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
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
