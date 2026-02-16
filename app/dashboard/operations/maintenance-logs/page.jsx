"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Wrench,
  MessageSquare,
  RefreshCw,
  Filter,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  LogIn,
  User,
  Truck,
  Shield,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

// Helper to format duration
function formatDuration(ms) {
  if (!ms) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

// Get date range for filter
function getDateRange(filter) {
  const now = new Date();
  const sgNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));

  switch (filter) {
    case "today": {
      const start = new Date(sgNow);
      start.setHours(0, 0, 0, 0);
      const end = new Date(sgNow);
      end.setHours(23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case "week": {
      const start = new Date(sgNow);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    case "month": {
      const start = new Date(sgNow);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    default:
      return { startDate: null, endDate: null };
  }
}

// Activity type badge
function ActivityTypeBadge({ type }) {
  if (type === "clean_wash") {
    return (
      <Badge variant="outline" className="gap-1">
        <Wrench className="h-3 w-3" />
        Clean/Wash
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <MessageSquare className="h-3 w-3" />
      Customer Feedback
    </Badge>
  );
}

// Login type badge
function LoginTypeBadge({ type }) {
  const config = {
    driver: { icon: Truck, label: "Driver", className: "bg-orange-100 text-orange-800" },
    maintenance: { icon: Wrench, label: "Maintenance", className: "bg-blue-100 text-blue-800" },
    admin: { icon: Shield, label: "Admin", className: "bg-purple-100 text-purple-800" },
  };

  const c = config[type] || { icon: User, label: type, className: "bg-gray-100 text-gray-800" };
  const Icon = c.icon;

  return (
    <Badge variant="secondary" className={`gap-1 ${c.className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

// Status badge component
function StatusBadge({ status }) {
  const config = {
    in_progress: {
      icon: Clock,
      label: "In Progress",
      className: "bg-blue-100 text-blue-800",
    },
    completed: {
      icon: CheckCircle,
      label: "Completed",
      className: "bg-green-100 text-green-800",
    },
    unresolved: {
      icon: AlertCircle,
      label: "Unresolved",
      className: "bg-red-100 text-red-800",
    },
  };

  const c = config[status] || config.in_progress;
  const Icon = c.icon;

  return (
    <Badge variant="secondary" className={`gap-1 ${c.className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

// Date filter buttons component
function DateFilterButtons({ value, onChange, className = "" }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {[
        { value: "all", label: "All" },
        { value: "today", label: "Today" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ].map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export default function MaintenanceLogsPage() {
  const [activities, setActivities] = useState([]);
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("logins");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pagination state for logins
  const [loginPage, setLoginPage] = useState(1);
  const [loginTotalPages, setLoginTotalPages] = useState(1);
  const [loginTotalCount, setLoginTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreLogins, setHasMoreLogins] = useState(true);
  const PAGE_SIZE = 50;

  // Pull to refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const scrollStartY = useRef(0);

  // Infinite scroll observer
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [loginTypeFilter, setLoginTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Check if mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch logins with pagination
  const fetchLogins = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", PAGE_SIZE.toString());

      if (loginTypeFilter !== "all") {
        params.set("loginType", loginTypeFilter);
      }
      if (searchText) {
        params.set("search", searchText);
      }
      if (dateFilter !== "all") {
        const { startDate, endDate } = getDateRange(dateFilter);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }

      const res = await fetch(`/api/maintenance/login?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (append) {
          setLogins((prev) => [...prev, ...data.logins]);
        } else {
          setLogins(data.logins);
        }
        setLoginPage(data.pagination.page);
        setLoginTotalPages(data.pagination.totalPages);
        setLoginTotalCount(data.pagination.totalCount);
        setHasMoreLogins(data.pagination.page < data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching logins:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [loginTypeFilter, searchText, dateFilter]);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance/activity");
      const data = await res.json();
      if (data.activities) {
        setActivities(data.activities);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchLogins(1);
    fetchActivities();
  }, []);

  // Refetch logins when filters change
  useEffect(() => {
    setLoginPage(1);
    fetchLogins(1);
  }, [loginTypeFilter, dateFilter]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchText !== undefined) {
        setLoginPage(1);
        fetchLogins(1);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

  // Infinite scroll setup for mobile
  useEffect(() => {
    if (!isMobile || activeTab !== "logins") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreLogins && !loadingMore && !loading) {
          fetchLogins(loginPage + 1, true);
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isMobile, activeTab, hasMoreLogins, loadingMore, loading, loginPage, fetchLogins]);

  // Pull to refresh handlers
  const handleTouchStart = (e) => {
    if (!isMobile || activeTab !== "logins") return;
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      scrollStartY.current = container.scrollTop;
    }
  };

  const handleTouchMove = (e) => {
    if (!isMobile || activeTab !== "logins" || touchStartY.current === 0) return;
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;
      if (diff > 0) {
        setIsPulling(true);
        setPullDistance(Math.min(diff * 0.5, 80));
      }
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && pullDistance > 60) {
      setRefreshing(true);
      fetchLogins(1);
    }
    setIsPulling(false);
    setPullDistance(0);
    touchStartY.current = 0;
  };

  function handleRefresh() {
    setRefreshing(true);
    setLoginPage(1);
    fetchLogins(1);
    fetchActivities();
  }

  function clearFilters() {
    setTypeFilter("all");
    setStatusFilter("all");
    setDeviceFilter("all");
    setSearchText("");
    setLoginTypeFilter("all");
    setDateFilter("all");
  }

  // Filter activities (client-side)
  const filteredActivities = activities.filter((activity) => {
    if (typeFilter !== "all" && activity.activityType !== typeFilter) {
      return false;
    }
    if (statusFilter !== "all" && activity.status !== statusFilter) {
      return false;
    }
    if (deviceFilter !== "all" && activity.deviceId !== deviceFilter) {
      return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        activity.deviceName?.toLowerCase().includes(search) ||
        activity.deviceId?.toLowerCase().includes(search) ||
        activity.notes?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Count by type
  const typeCounts = {
    clean_wash: activities.filter((a) => a.activityType === "clean_wash").length,
    customer_feedback: activities.filter((a) => a.activityType === "customer_feedback").length,
  };

  // Count by status
  const statusCounts = {
    in_progress: activities.filter((a) => a.status === "in_progress").length,
    completed: activities.filter((a) => a.status === "completed").length,
    unresolved: activities.filter((a) => a.status === "unresolved").length,
  };

  // Get unique devices from activities
  const uniqueDevices = [
    ...new Map(
      activities.map((a) => [a.deviceId, { id: a.deviceId, name: a.deviceName }])
    ).values(),
  ];

  // Desktop pagination handlers
  const handlePrevPage = () => {
    if (loginPage > 1) {
      fetchLogins(loginPage - 1);
    }
  };

  const handleNextPage = () => {
    if (loginPage < loginTotalPages) {
      fetchLogins(loginPage + 1);
    }
  };

  if (loading && logins.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Maintenance Logs</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              View all maintenance activities
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 md:h-9"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 md:mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 md:mb-6 w-full md:w-auto grid grid-cols-2 md:flex">
            <TabsTrigger value="logins" className="gap-1 md:gap-2 text-xs md:text-sm">
              <LogIn className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Login History</span>
              <span className="sm:hidden">Logins</span>
              <span className="hidden md:inline">({loginTotalCount})</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-1 md:gap-2 text-xs md:text-sm">
              <Wrench className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Activities
              <span className="hidden md:inline">({activities.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Login History Tab */}
          <TabsContent value="logins">
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
                    placeholder="Search by device, user..."
                    className="w-64"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />

                  <Select value={loginTypeFilter} onValueChange={setLoginTypeFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Login Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <DateFilterButtons value={dateFilter} onChange={setDateFilter} />
                  </div>

                  {(loginTypeFilter !== "all" || dateFilter !== "all" || searchText) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-1 h-4 w-4" />
                      Clear
                    </Button>
                  )}

                  <span className="ml-auto text-sm text-muted-foreground">
                    {loginTotalCount} logins
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
                      {(loginTypeFilter !== "all" || dateFilter !== "all" || searchText) && (
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
                  <div className="flex items-center justify-between">
                    <Select value={loginTypeFilter} onValueChange={setLoginTypeFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <DateFilterButtons value={dateFilter} onChange={setDateFilter} />
                  </div>
                  <div className="flex items-center justify-between">
                    {(loginTypeFilter !== "all" || dateFilter !== "all" || searchText) && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-1 h-4 w-4" />
                        Clear
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {loginTotalCount} logins
                    </span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Logins Table - Desktop */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>PIN</TableHead>
                      <TableHead>Login Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No login records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logins.map((login) => (
                        <TableRow key={login.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{login.deviceName}</div>
                              <div className="text-xs text-muted-foreground">{login.deviceId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{login.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <LoginTypeBadge type={login.loginType} />
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {login.pin || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(login.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>

              {/* Desktop Pagination */}
              {loginTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {loginPage} of {loginTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={loginPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={loginPage === loginTotalPages || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Logins Cards - Mobile with infinite scroll */}
            <div
              ref={containerRef}
              className="md:hidden space-y-3"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Pull to refresh indicator */}
              {isPulling && (
                <div
                  className="flex items-center justify-center transition-all"
                  style={{ height: pullDistance }}
                >
                  <RefreshCw
                    className={`h-5 w-5 text-muted-foreground ${pullDistance > 60 ? "text-primary" : ""}`}
                    style={{ transform: `rotate(${pullDistance * 3}deg)` }}
                  />
                </div>
              )}

              {refreshing && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              {logins.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No login records found
                  </CardContent>
                </Card>
              ) : (
                <>
                  {logins.map((login) => (
                    <Card key={login.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{login.deviceName}</p>
                            <p className="text-xs text-muted-foreground">{login.deviceId}</p>
                          </div>
                          <LoginTypeBadge type={login.loginType} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{login.userName}</span>
                            {login.pin && <span className="font-mono text-muted-foreground">({login.pin})</span>}
                          </div>
                          <span className="text-muted-foreground">{formatDateTime(login.createdAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Infinite scroll trigger */}
                  <div ref={loadMoreRef} className="py-4 flex items-center justify-center">
                    {loadingMore ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : hasMoreLogins ? (
                      <span className="text-xs text-muted-foreground">Scroll for more</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No more records</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities">
            {/* Activity Summary Cards */}
            <div className="mb-4 md:mb-6 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <Card
                className={`cursor-pointer transition-colors ${typeFilter === "clean_wash" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setTypeFilter(typeFilter === "clean_wash" ? "all" : "clean_wash")}
              >
                <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-1 md:gap-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-blue-100">
                      <Wrench className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-xs md:text-sm">Clean</span>
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{typeCounts.clean_wash}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${typeFilter === "customer_feedback" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setTypeFilter(typeFilter === "customer_feedback" ? "all" : "customer_feedback")}
              >
                <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-1 md:gap-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-purple-100">
                      <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                    </div>
                    <span className="font-medium text-xs md:text-sm">Feedback</span>
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{typeCounts.customer_feedback}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${statusFilter === "in_progress" ? "ring-2 ring-blue-500" : ""}`}
                onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
              >
                <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-1 md:gap-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-yellow-100">
                      <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
                    </div>
                    <span className="font-medium text-xs md:text-sm hidden sm:inline">In Progress</span>
                    <span className="font-medium text-xs md:text-sm sm:hidden">Active</span>
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{statusCounts.in_progress}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${statusFilter === "completed" ? "ring-2 ring-green-500" : ""}`}
                onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
              >
                <CardContent className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 gap-1 md:gap-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                    </div>
                    <span className="font-medium text-xs md:text-sm">Done</span>
                  </div>
                  <span className="text-xl md:text-2xl font-bold">{statusCounts.completed}</span>
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
                    placeholder="Search by device, notes..."
                    className="w-64"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="clean_wash">Clean/Wash</SelectItem>
                      <SelectItem value="customer_feedback">Feedback</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="unresolved">Unresolved</SelectItem>
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

                  {(typeFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || searchText) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-1 h-4 w-4" />
                      Clear
                    </Button>
                  )}

                  <span className="ml-auto text-sm text-muted-foreground">
                    {filteredActivities.length} of {activities.length} logs
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
                      {(typeFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || searchText) && (
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
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="clean_wash">Clean/Wash</SelectItem>
                        <SelectItem value="customer_feedback">Feedback</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="unresolved">Unresolved</SelectItem>
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
                    {(typeFilter !== "all" || statusFilter !== "all" || deviceFilter !== "all" || searchText) && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-1 h-4 w-4" />
                        Clear
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {filteredActivities.length} of {activities.length} logs
                    </span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Activities Table - Desktop */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          No maintenance logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredActivities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{activity.deviceName}</div>
                              <div className="text-xs text-muted-foreground">{activity.deviceId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ActivityTypeBadge type={activity.activityType} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={activity.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(activity.startedAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(activity.completedAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(activity.durationMs)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {activity.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Activities Cards - Mobile */}
            <div className="md:hidden space-y-3">
              {filteredActivities.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No maintenance logs found
                  </CardContent>
                </Card>
              ) : (
                filteredActivities.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{activity.deviceName}</p>
                          <p className="text-xs text-muted-foreground">{activity.deviceId}</p>
                        </div>
                        <StatusBadge status={activity.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <ActivityTypeBadge type={activity.activityType} />
                        {activity.durationMs && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(activity.durationMs)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs space-y-1">
                        <p><span className="text-muted-foreground">Started:</span> {formatDateTime(activity.startedAt)}</p>
                        {activity.completedAt && (
                          <p><span className="text-muted-foreground">Completed:</span> {formatDateTime(activity.completedAt)}</p>
                        )}
                        {activity.notes && (
                          <p className="text-muted-foreground line-clamp-2">{activity.notes}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
