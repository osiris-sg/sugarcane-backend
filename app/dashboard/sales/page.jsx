"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ClipboardList,
  Search,
  Download,
  Filter,
  RefreshCw,
  X,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Banknote,
  Gift,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
} from "lucide-react";
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
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import * as XLSX from "xlsx";

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

// Short date format for mobile
function formatDateShort(dateString) {
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

// Helper to format currency
function formatCurrency(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Map payWay codes to friendly names
function getPaymentMethod(payWay) {
  const payWayMap = {
    "2": { label: "Cashless", icon: "card" },
    "1000": { label: "Free", icon: "free" },
  };

  if (!payWay) return null;

  const mapped = payWayMap[String(payWay)];
  if (mapped) return mapped;

  // Fallback for unknown codes
  return { label: payWay, icon: "card" };
}

const ITEMS_PER_PAGE = 50;

export default function OrderListPage() {
  const [orders, setOrders] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [allTimeTotal, setAllTimeTotal] = useState(0);
  const [allTimeCount, setAllTimeCount] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allDevices, setAllDevices] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState("all");
  const [isAdmin, setIsAdmin] = useState(false);

  // Mobile infinite scroll state
  const [mobileOrders, setMobileOrders] = useState([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef(null);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);
  const containerRef = useRef(null);


  // Filters
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [payWayFilter, setPayWayFilter] = useState("all");
  const [dateRange, setDateRange] = useState("today"); // all, today, week, month, custom
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Sorting
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort("createdAt", "desc");

  // Debounce search text - wait 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Build query params for API call
  function buildQueryParams(page = 1) {
    const params = new URLSearchParams();
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("page", String(page));

    // Add device filter
    if (deviceFilter !== "all") {
      params.set("deviceId", deviceFilter);
    }

    // Add group filter (admin only)
    if (groupFilter !== "all") {
      params.set("groupId", groupFilter);
    }

    // Add date range filter
    // Use SGT timezone (UTC+8) for all date calculations
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
        // For custom dates, interpret as SGT (Asia/Singapore, UTC+8)
        if (customStartDate) {
          // Parse as SGT midnight (00:00:00+08:00)
          params.set("startDate", new Date(customStartDate + "T00:00:00+08:00").toISOString());
        }
        if (customEndDate) {
          // Parse as SGT midnight + 1 day to make end date inclusive
          // e.g., selecting Jan 31 means include all of Jan 31 (up to 23:59:59)
          const endDate = new Date(customEndDate + "T00:00:00+08:00");
          endDate.setDate(endDate.getDate() + 1);
          params.set("endDate", endDate.toISOString());
        }
        break;
    }

    // Add payment method filter
    if (payWayFilter !== "all") {
      params.set("payWay", payWayFilter);
    }

    // Add search filter
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    return params.toString();
  }

  async function fetchOrders(page = currentPage, isRefresh = false) {
    try {
      setRefreshing(true);
      const queryString = buildQueryParams(page);
      const res = await fetch(`/api/admin/orders?${queryString}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders || []);
        // For mobile: reset or set orders on refresh/filter change
        if (isRefresh || page === 1) {
          setMobileOrders(data.orders || []);
          setMobilePage(1);
          setHasMore((data.pagination?.totalPages || 1) > 1);
        }
        setFilteredTotal(data.filteredTotal || 0);
        setFilteredCount(data.filteredCount || 0);
        setAllTimeTotal(data.allTimeTotal || 0);
        setAllTimeCount(data.allTimeCount || 0);
        setMonthlyTotal(data.monthlyTotal || 0);
        setMonthlyCount(data.monthlyCount || 0);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.totalCount || 0);
        }
        // Set isAdmin from API response
        if (data.isAdmin !== undefined) {
          setIsAdmin(data.isAdmin);
        }
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  // Fetch more orders for mobile infinite scroll
  async function fetchMoreOrders() {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = mobilePage + 1;
      const queryString = buildQueryParams(nextPage);
      const res = await fetch(`/api/admin/orders?${queryString}`);
      const data = await res.json();

      if (data.success && data.orders?.length > 0) {
        setMobileOrders(prev => [...prev, ...data.orders]);
        setMobilePage(nextPage);
        setHasMore(nextPage < (data.pagination?.totalPages || 1));
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more orders:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !refreshing) {
          fetchMoreOrders();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, refreshing, mobilePage]);

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

  // Pull-to-refresh handlers - use window scroll
  const handleTouchStart = useCallback((e) => {
    // Check if we're at the top of the page
    if (window.scrollY <= 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling) return;
    // Only allow pull if at top of page
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
      // Trigger refresh
      setMobilePage(1);
      setMobileOrders([]);
      setHasMore(true);
      fetchOrders(1, true);
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, refreshing]);

  // Fetch all devices for filter dropdown
  async function fetchDevices() {
    try {
      const res = await fetch("/api/admin/devices");
      const data = await res.json();
      if (data.success && data.devices) {
        setAllDevices(data.devices.map(d => ({ id: d.deviceId, name: d.location || d.deviceId })));
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  }

  // Fetch all groups for filter dropdown (admin/finance only)
  async function fetchGroups() {
    try {
      const res = await fetch("/api/admin/groups");
      const data = await res.json();
      if (data.success && data.groups) {
        setAllGroups(data.groups.map(g => ({ id: g.id, name: g.name })));
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  }

  // Fetch devices and groups once on mount
  useEffect(() => {
    fetchDevices();
    fetchGroups();
  }, []);

  // Reset to page 1 when filters change (except page itself)
  // Note: customStartDate/customEndDate excluded - only apply on button click
  useEffect(() => {
    setCurrentPage(1);
    setMobilePage(1);
    setMobileOrders([]);
    setHasMore(true);
  }, [deviceFilter, dateRange, payWayFilter, debouncedSearch, groupFilter]);

  // Fetch orders when filters or page change
  // Note: customStartDate/customEndDate excluded - only apply on button click
  useEffect(() => {
    // For custom date range, don't auto-fetch - wait for Apply button
    if (dateRange === "custom") return;
    fetchOrders(currentPage, currentPage === 1);
  }, [deviceFilter, dateRange, payWayFilter, debouncedSearch, currentPage, groupFilter]);

  // Handler for custom date Apply button
  function handleCustomDateApply() {
    setCurrentPage(1);
    setMobilePage(1);
    setMobileOrders([]);
    setHasMore(true);
    fetchOrders(1, true);
  }

  function handleRefresh() {
    setRefreshing(true);
    setMobilePage(1);
    setMobileOrders([]);
    setHasMore(true);
    fetchOrders(1, true);
  }

  function clearFilters() {
    setSearchText("");
    setDeviceFilter("all");
    setPayWayFilter("all");
    setGroupFilter("all");
    setDateRange("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(1);
  }

  // All filtering is now server-side
  const filteredOrders = orders;

  // Get unique payment methods from current orders (devices come from allDevices)
  const uniquePayWays = [...new Set(orders.map((o) => o.payWay).filter(Boolean))];

  // Sort filtered orders (client-side sorting of current page)
  const sortedOrders = sortData(filteredOrders);

  // Server-side pagination - orders are already paginated from API
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalCount);

  // Filtered stats now come from server (filteredTotal, filteredCount state variables)

  // Get label suffix based on active filters
  const getFilterLabel = () => {
    const parts = [];
    if (deviceFilter !== "all") {
      const device = allDevices.find((d) => d.id === deviceFilter);
      parts.push(device?.name || deviceFilter);
    }
    if (dateRange === "today") parts.push("Today");
    else if (dateRange === "week") parts.push("Last 7 Days");
    else if (dateRange === "month") parts.push("Last 30 Days");
    else if (dateRange === "custom" && (customStartDate || customEndDate)) parts.push("Custom Range");

    return parts.length > 0 ? parts.join(" - ") : null;
  };

  const filterLabel = getFilterLabel();
  const hasFilters = deviceFilter !== "all" || payWayFilter !== "all" || groupFilter !== "all" || dateRange !== "all" || searchText;

  // Export to CSV - fetch all orders matching current filters
  const [exporting, setExporting] = useState(false);

  async function exportToCSV() {
    setExporting(true);
    try {
      // Build query params without pagination to get ALL filtered orders
      const params = new URLSearchParams();
      params.set("limit", "100000"); // Large limit to get all
      params.set("page", "1");

      // Add device filter
      if (deviceFilter !== "all") {
        params.set("deviceId", deviceFilter);
      }

      // Add group filter
      if (groupFilter !== "all") {
        params.set("groupId", groupFilter);
      }

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
          // For custom dates, interpret as SGT (Asia/Singapore, UTC+8)
          if (customStartDate) {
            params.set("startDate", new Date(customStartDate + "T00:00:00+08:00").toISOString());
          }
          if (customEndDate) {
            // Add 1 day to make end date inclusive (e.g., Jan 31 includes all of Jan 31)
            const endDate = new Date(customEndDate + "T00:00:00+08:00");
            endDate.setDate(endDate.getDate() + 1);
            params.set("endDate", endDate.toISOString());
          }
          break;
      }

      // Add payment method filter
      if (payWayFilter !== "all") {
        params.set("payWay", payWayFilter);
      }

      // Add search filter
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();

      if (!data.success || !data.orders) {
        alert("Failed to fetch orders for export");
        return;
      }

      const allOrders = data.orders;

      const headers = isAdmin
        ? ["Order ID", "Terminal ID", "Device Name", "Group", "Date", "Status", "PayWay", "Amount", "Refund", "TotalCount", "DeliverCount"]
        : ["Order ID", "Terminal ID", "Device Name", "Date", "Status", "PayWay", "Amount", "Refund", "TotalCount", "DeliverCount"];
      const rows = allOrders.map((o) => {
        const baseRow = [
          o.orderId,
          o.deviceId,
          o.deviceName,
        ];
        if (isAdmin) {
          baseRow.push(o.groupName || "-");
        }
        baseRow.push(
          new Date(o.createdAt).toLocaleString("en-SG", {
            timeZone: "Asia/Singapore",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).replace(",", ""),
          o.isSuccess ? "Success" : "Failed",
          getPaymentMethod(o.payWay)?.label || "-",
          (o.amount / 100).toFixed(2),
          o.refundAmount ? (o.refundAmount / 100).toFixed(2) : "",
          o.totalCount ?? o.quantity ?? 1,
          o.deliverCount ?? o.quantity ?? 1,
        );
        return baseRow;
      });

      // Create Excel workbook
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");

      // Generate filename based on date range
      let filename;
      const today = new Date().toISOString().split("T")[0];
      switch (dateRange) {
        case "today":
          filename = `orders-${today}.xlsx`;
          break;
        case "week":
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filename = `orders-${weekAgo.toISOString().split("T")[0]}-to-${today}.xlsx`;
          break;
        case "month":
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          filename = `orders-${monthAgo.toISOString().split("T")[0]}-to-${today}.xlsx`;
          break;
        case "custom":
          if (customStartDate && customEndDate) {
            filename = `orders-${customStartDate}-to-${customEndDate}.xlsx`;
          } else if (customStartDate) {
            filename = `orders-from-${customStartDate}.xlsx`;
          } else if (customEndDate) {
            filename = `orders-until-${customEndDate}.xlsx`;
          } else {
            filename = `orders-${today}.xlsx`;
          }
          break;
        default:
          filename = `orders-all-time.xlsx`;
      }

      // Download Excel file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting orders:", error);
      alert("Failed to export orders");
    } finally {
      setExporting(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator - shown at very top */}
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
      <header className="sticky top-0 z-30 border-b bg-background px-4 py-3 md:px-6 md:py-0 md:h-16 md:flex md:items-center md:justify-between">
        <div className="flex items-center justify-between md:block">
          <div>
            <h1 className="text-lg font-semibold md:text-xl">Order List</h1>
            <p className="text-xs text-muted-foreground md:text-sm">View all transactions</p>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={exportToCSV} disabled={exporting}>
              <Download className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
            </Button>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={exporting}>
            <Download className={`mr-2 h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {/* Summary Cards */}
        <div className="mb-4 md:mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-green-100 shrink-0">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {hasFilters ? "Filtered Rev" : "All Time Rev"}
                  </p>
                  <p className="text-base md:text-xl font-bold">
                    {formatCurrency(hasFilters ? filteredTotal : allTimeTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-blue-100 shrink-0">
                  <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {hasFilters ? "Filtered Ord" : "All Time Ord"}
                  </p>
                  <p className="text-base md:text-xl font-bold">
                    {hasFilters ? filteredCount : allTimeCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-purple-100 shrink-0">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Monthly Rev</p>
                  <p className="text-base md:text-xl font-bold">{formatCurrency(monthlyTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-orange-100 shrink-0">
                  <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Monthly Ord</p>
                  <p className="text-base md:text-xl font-bold">{monthlyCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters - Collapsible on mobile */}
        <Card className="mb-4 md:mb-6">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer md:cursor-default" onClick={(e) => {
                // Only trigger collapse on mobile
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
              <CardContent className={`space-y-3 md:space-y-0 ${!filtersOpen ? "hidden md:block" : ""}`}>
                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      className="pl-10"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:flex md:gap-4">
                    <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Device" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Devices</SelectItem>
                        {allDevices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name || device.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={payWayFilter} onValueChange={setPayWayFilter}>
                      <SelectTrigger className="w-full md:w-40">
                        <SelectValue placeholder="Payment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payments</SelectItem>
                        {uniquePayWays.map((payWay) => (
                          <SelectItem key={payWay} value={payWay}>
                            {getPaymentMethod(payWay)?.label || payWay}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {isAdmin && (
                      <Select value={groupFilter} onValueChange={setGroupFilter}>
                        <SelectTrigger className="w-full md:w-48">
                          <SelectValue placeholder="Group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Groups</SelectItem>
                          {allGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <Select value={dateRange} onValueChange={(v) => {
                    setDateRange(v);
                    if (v !== "custom") {
                      setCustomStartDate("");
                      setCustomEndDate("");
                    }
                  }}>
                    <SelectTrigger className="w-full md:w-40">
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
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Input
                        type="date"
                        className="flex-1 md:w-36"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        placeholder="Start date"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="date"
                        className="flex-1 md:w-36"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        placeholder="End date"
                      />
                      <Button
                        size="sm"
                        onClick={handleCustomDateApply}
                        disabled={refreshing || (!customStartDate && !customEndDate)}
                      >
                        Apply
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between md:ml-auto">
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-1 h-4 w-4" />
                        Clear
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground ml-auto">
                      {totalCount} total
                    </span>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Orders Table - Desktop */}
        <Card className="hidden md:block relative overflow-hidden">
          {/* Loading bar */}
          {refreshing && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-muted overflow-hidden z-10">
              <div className="h-full bg-primary w-1/3 animate-pulse"
                   style={{ animation: 'slide 1s ease-in-out infinite' }} />
            </div>
          )}
          <style>{`
            @keyframes slide {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>
          <CardContent className="p-0">
            <div className="max-h-[calc(100vh-420px)] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <SortableTableHead column="orderId" label="Order ID" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="deviceId" label="Terminal" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="deviceName" label="Device Name" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    {isAdmin && <SortableTableHead column="groupName" label="Group" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />}
                    <SortableTableHead column="createdAt" label="Time" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="isSuccess" label="Status" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="payWay" label="PayWay" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="amount" label="Amount" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="refundAmount" label="Refund" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="totalCount" label="Total" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableTableHead column="deliverCount" label="Delivered" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 11 : 10} className="py-8 text-center text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedOrders.map((order) => (
                      <TableRow key={order.id} className={!order.isSuccess ? "bg-red-50" : ""}>
                        <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                        <TableCell className="font-mono text-sm">{order.deviceId}</TableCell>
                        <TableCell className="text-sm">{order.deviceName || "-"}</TableCell>
                        {isAdmin && <TableCell className="text-sm">{order.groupName || "-"}</TableCell>}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          {order.isSuccess ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.payWay ? (
                            <Badge variant="outline" className="gap-1">
                              {getPaymentMethod(order.payWay)?.icon === "free" ? (
                                <Gift className="h-3 w-3" />
                              ) : getPaymentMethod(order.payWay)?.icon === "cash" ? (
                                <Banknote className="h-3 w-3" />
                              ) : (
                                <CreditCard className="h-3 w-3" />
                              )}
                              {getPaymentMethod(order.payWay)?.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(order.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.refundAmount ? formatCurrency(order.refundAmount) : "-"}
                        </TableCell>
                        <TableCell>{order.totalCount ?? order.quantity ?? 1}</TableCell>
                        <TableCell>{order.deliverCount ?? order.quantity ?? 1}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {/* Pagination - Desktop */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{endIndex} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || refreshing}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  {refreshing ? "Loading..." : `Page ${currentPage} of ${totalPages}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || refreshing}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Orders List - Mobile (Card view with pull-to-refresh and infinite scroll) */}
        <div className="md:hidden space-y-3" ref={containerRef}>
          {/* Loading bar - Mobile */}
          {refreshing && (
            <div className="h-1 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary w-1/3"
                   style={{ animation: 'slide 1s ease-in-out infinite' }} />
            </div>
          )}

          {mobileOrders.length === 0 && !refreshing ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No orders found
              </CardContent>
            </Card>
          ) : (
            <>
              {mobileOrders.map((order, index) => (
                <Card key={`${order.id}-${index}`} className={!order.isSuccess ? "border-red-200 bg-red-50/50" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{order.deviceName || order.deviceId}</p>
                          {order.isSuccess ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                              Failed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{order.deviceId}</p>
                      </div>
                      <p className="text-lg font-bold">{formatCurrency(order.amount)}</p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {order.payWay ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            {getPaymentMethod(order.payWay)?.icon === "free" ? (
                              <Gift className="h-3 w-3" />
                            ) : (
                              <CreditCard className="h-3 w-3" />
                            )}
                            {getPaymentMethod(order.payWay)?.label}
                          </Badge>
                        ) : null}
                        <span className="text-muted-foreground">
                          {order.deliverCount ?? order.quantity ?? 1}/{order.totalCount ?? order.quantity ?? 1}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateShort(order.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Load more trigger */}
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                )}
                {!hasMore && mobileOrders.length > 0 && (
                  <span className="text-sm text-muted-foreground">No more orders</span>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
