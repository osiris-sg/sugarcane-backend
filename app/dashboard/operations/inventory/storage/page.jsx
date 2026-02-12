"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Warehouse,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;
const STALE_DAYS = 3; // Flag if storage hasn't changed in 3+ days

// Helper to format relative time
function formatLastUpdated(dateString) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return "Recently";
}

// Check if storage is stale (not updated in STALE_DAYS days)
// If quantity is 0, don't flag as stale
function isStorageStale(dateString, quantity) {
  if (quantity === 0) return false;
  if (!dateString) return true;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= STALE_DAYS;
}

export default function StoragePage() {
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [staleFilter, setStaleFilter] = useState("all"); // all, stale, active
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setRefreshing(true);
      const [devicesRes, groupsRes] = await Promise.all([
        fetch("/api/admin/devices"),
        fetch("/api/admin/groups"),
      ]);

      const devicesData = await devicesRes.json();
      const groupsData = await groupsRes.json();

      if (devicesData.devices) {
        setDevices(devicesData.devices);
      }
      if (groupsData.groups) {
        setGroups(groupsData.groups);
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

  // Filter devices
  const filteredDevices = devices
    .filter((d) => {
      // Exclude unresponsive devices
      if (d.isUnresponsive) return false;

      // Search filter
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchesSearch =
          d.deviceId.toLowerCase().includes(search) ||
          (d.deviceName && d.deviceName.toLowerCase().includes(search)) ||
          (d.location && d.location.toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Group filter
      if (groupFilter !== "all") {
        if (!d.allGroups?.some((g) => g.id === groupFilter)) return false;
      }

      // Stale filter
      if (staleFilter !== "all") {
        const stale = isStorageStale(d.storageUpdatedAt, d.storageQuantity);
        if (staleFilter === "stale" && !stale) return false;
        if (staleFilter === "active" && stale) return false;
      }

      return true;
    })
    // Sort by storage quantity (most to least)
    .sort((a, b) => {
      const storageA = a.storageQuantity ?? -1;
      const storageB = b.storageQuantity ?? -1;
      return storageB - storageA;
    });

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(filteredDevices, ITEMS_PER_PAGE);
  const paginatedDevices = getPageItems(currentPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, groupFilter, staleFilter]);

  // Summary stats (exclude unresponsive devices)
  const devicesWithStorage = devices.filter((d) => d.storageQuantity !== null && !d.isUnresponsive);
  const totalStorage = devicesWithStorage.reduce((sum, d) => sum + (d.storageQuantity || 0), 0);
  const staleCount = devicesWithStorage.filter((d) => isStorageStale(d.storageUpdatedAt, d.storageQuantity)).length;
  const activeCount = devicesWithStorage.filter((d) => !isStorageStale(d.storageUpdatedAt, d.storageQuantity)).length;

  const hasFilters = searchText || groupFilter !== "all" || staleFilter !== "all";

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
            <h1 className="text-lg md:text-xl font-semibold">Storage Levels</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Device storage sorted by highest first
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
        {/* Summary Cards */}
        <div className="mb-4 md:mb-6 grid grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Warehouse className="h-4 w-4 text-blue-600" />
                <span className="text-xs md:text-sm text-muted-foreground">Total Storage</span>
              </div>
              <p className="text-xl md:text-2xl font-bold">{totalStorage}</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${staleFilter === "stale" ? "ring-2 ring-orange-500" : ""}`}
            onClick={() => setStaleFilter(staleFilter === "stale" ? "all" : "stale")}
          >
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-xs md:text-sm text-muted-foreground">Stale ({STALE_DAYS}+ days)</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-orange-600">{staleCount}</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${staleFilter === "active" ? "ring-2 ring-green-500" : ""}`}
            onClick={() => setStaleFilter(staleFilter === "active" ? "all" : "active")}
          >
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-xs md:text-sm text-muted-foreground">Recently Updated</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-green-600">{activeCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4 md:mb-6">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer md:cursor-default" onClick={(e) => {
                if (window.innerWidth >= 768) {
                  e.preventDefault();
                  setFiltersOpen(true);
                }
              }}>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasFilters && (
                      <Badge variant="secondary" className="ml-2">Active</Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 md:hidden transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent className="md:block" forceMount>
              <CardContent className={`space-y-3 md:space-y-0 pt-0 ${!filtersOpen ? "hidden md:block" : ""}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <div className="relative flex-1 md:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search devices..."
                      className="pl-10"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                  </div>

                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center justify-between md:ml-auto">
                    {hasFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchText("");
                          setGroupFilter("all");
                          setStaleFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground ml-auto">
                      {filteredDevices.length} devices
                    </span>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Storage Table - Desktop */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Storage Quantity</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No devices found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDevices.map((device) => {
                    const stale = isStorageStale(device.storageUpdatedAt, device.storageQuantity);
                    return (
                      <TableRow
                        key={device.deviceId}
                        className={stale ? "bg-orange-50" : ""}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{device.location || device.deviceName}</div>
                            <div className="text-xs text-muted-foreground">{device.deviceId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {device.allGroups?.map((g) => g.name).join(", ") || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {device.storageQuantity !== null ? (
                            <span className="text-lg font-bold">{device.storageQuantity}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm ${stale ? "text-orange-600" : "text-muted-foreground"}`}>
                            {formatLastUpdated(device.storageUpdatedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {stale ? (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Stale
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
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

        {/* Storage Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {paginatedDevices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No devices found
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedDevices.map((device) => {
                const stale = isStorageStale(device.storageUpdatedAt, device.storageQuantity);
                return (
                  <Card
                    key={device.deviceId}
                    className={`border-l-4 ${stale ? "border-l-orange-500" : "border-l-green-500"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-medium">{device.location || device.deviceName}</div>
                          <div className="text-xs text-muted-foreground">{device.deviceId}</div>
                          {device.allGroups?.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {device.allGroups.map((g) => g.name).join(", ")}
                            </div>
                          )}
                        </div>
                        {stale && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-2xl font-bold">
                            {device.storageQuantity ?? "-"}
                          </span>
                          <span className="text-sm text-muted-foreground ml-1">units</span>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm ${stale ? "text-orange-600" : "text-muted-foreground"}`}>
                            {formatLastUpdated(device.storageUpdatedAt)}
                          </div>
                          {stale && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs mt-1">
                              Stale
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
