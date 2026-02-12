"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Package,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

export default function StockPage() {
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all"); // all, low, medium, high
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

      // Stock level filter
      if (stockFilter !== "all" && d.cupStock !== null) {
        if (stockFilter === "low" && d.cupStock >= 25) return false;
        if (stockFilter === "medium" && (d.cupStock < 25 || d.cupStock >= 50)) return false;
        if (stockFilter === "high" && d.cupStock < 50) return false;
      }

      return true;
    })
    // Sort by stock level (least to most)
    .sort((a, b) => {
      const stockA = a.cupStock ?? 999;
      const stockB = b.cupStock ?? 999;
      return stockA - stockB;
    });

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(filteredDevices, ITEMS_PER_PAGE);
  const paginatedDevices = getPageItems(currentPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, groupFilter, stockFilter]);

  // Summary stats
  const devicesWithStock = devices.filter((d) => d.cupStock !== null);
  const lowStockCount = devicesWithStock.filter((d) => d.cupStock < 25).length;
  const mediumStockCount = devicesWithStock.filter((d) => d.cupStock >= 25 && d.cupStock < 50).length;
  const highStockCount = devicesWithStock.filter((d) => d.cupStock >= 50).length;

  const hasFilters = searchText || groupFilter !== "all" || stockFilter !== "all";

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
            <h1 className="text-lg md:text-xl font-semibold">Stock Levels</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Device stock sorted by lowest first
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
          <Card
            className={`cursor-pointer transition-colors ${stockFilter === "low" ? "ring-2 ring-red-500" : ""}`}
            onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}
          >
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-xs md:text-sm text-muted-foreground">Low (&lt;25%)</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-red-600">{lowStockCount}</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${stockFilter === "medium" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setStockFilter(stockFilter === "medium" ? "all" : "medium")}
          >
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="text-xs md:text-sm text-muted-foreground">Medium (25-50%)</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-yellow-600">{mediumStockCount}</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors ${stockFilter === "high" ? "ring-2 ring-green-500" : ""}`}
            onClick={() => setStockFilter(stockFilter === "high" ? "all" : "high")}
          >
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-xs md:text-sm text-muted-foreground">Good (&gt;50%)</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-green-600">{highStockCount}</p>
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
                          setStockFilter("all");
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

        {/* Stock Table - Desktop */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Min Threshold</TableHead>
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
                  paginatedDevices.map((device) => (
                    <TableRow
                      key={device.deviceId}
                      className={device.cupStock !== null && device.cupStock < 25 ? "bg-red-50" : ""}
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
                        {device.cupStock !== null ? (
                          <div className="flex items-center gap-3">
                            <Progress
                              value={device.cupStock}
                              className={`h-2 w-24 ${
                                device.cupStock < 25
                                  ? "[&>div]:bg-red-500"
                                  : device.cupStock < 50
                                  ? "[&>div]:bg-yellow-500"
                                  : "[&>div]:bg-green-500"
                              }`}
                            />
                            <span
                              className={`text-sm font-medium ${
                                device.cupStock < 25
                                  ? "text-red-600"
                                  : device.cupStock < 50
                                  ? "text-yellow-600"
                                  : "text-green-600"
                              }`}
                            >
                              {device.cupStock}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {device.stockQuantity !== null ? (
                          <span className="text-sm">
                            {device.stockQuantity} / {device.stockMax}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm ${
                            device.stockQuantity !== null &&
                            device.stockQuantity <= device.minStockThreshold
                              ? "text-red-600 font-medium"
                              : ""
                          }`}
                        >
                          {device.minStockThreshold}
                        </span>
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

        {/* Stock Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {paginatedDevices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No devices found
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedDevices.map((device) => (
                <Card
                  key={device.deviceId}
                  className={`border-l-4 ${
                    device.cupStock === null
                      ? "border-l-gray-300"
                      : device.cupStock < 25
                      ? "border-l-red-500"
                      : device.cupStock < 50
                      ? "border-l-yellow-500"
                      : "border-l-green-500"
                  }`}
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
                      {device.cupStock !== null && device.cupStock < 25 && (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    {device.cupStock !== null ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Progress
                            value={device.cupStock}
                            className={`h-2 flex-1 ${
                              device.cupStock < 25
                                ? "[&>div]:bg-red-500"
                                : device.cupStock < 50
                                ? "[&>div]:bg-yellow-500"
                                : "[&>div]:bg-green-500"
                            }`}
                          />
                          <span
                            className={`text-sm font-bold ${
                              device.cupStock < 25
                                ? "text-red-600"
                                : device.cupStock < 50
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {device.cupStock}%
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {device.stockQuantity} / {device.stockMax} (min: {device.minStockThreshold})
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">No stock data</div>
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
