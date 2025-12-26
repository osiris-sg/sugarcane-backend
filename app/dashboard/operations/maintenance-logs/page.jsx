"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
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

export default function MaintenanceLogsPage() {
  const [activities, setActivities] = useState([]);
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("logins");

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [loginTypeFilter, setLoginTypeFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [activityRes, loginRes] = await Promise.all([
        fetch("/api/maintenance/activity"),
        fetch("/api/maintenance/login?limit=200"),
      ]);

      const activityData = await activityRes.json();
      const loginData = await loginRes.json();

      if (activityData.activities) {
        setActivities(activityData.activities);
      }
      if (loginData.logins) {
        setLogins(loginData.logins);
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
    setTypeFilter("all");
    setStatusFilter("all");
    setDeviceFilter("all");
    setSearchText("");
    setLoginTypeFilter("all");
  }

  // Filter activities
  const filteredActivities = activities.filter((activity) => {
    // Type filter
    if (typeFilter !== "all" && activity.activityType !== typeFilter) {
      return false;
    }
    // Status filter
    if (statusFilter !== "all" && activity.status !== statusFilter) {
      return false;
    }
    // Device filter
    if (deviceFilter !== "all" && activity.deviceId !== deviceFilter) {
      return false;
    }
    // Search text
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

  // Count logins by type
  const loginTypeCounts = {
    driver: logins.filter((l) => l.loginType === "driver").length,
    maintenance: logins.filter((l) => l.loginType === "maintenance").length,
    admin: logins.filter((l) => l.loginType === "admin").length,
  };

  // Filter logins
  const filteredLogins = logins.filter((login) => {
    if (loginTypeFilter !== "all" && login.loginType !== loginTypeFilter) {
      return false;
    }
    if (deviceFilter !== "all" && login.deviceId !== deviceFilter) {
      return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        login.deviceName?.toLowerCase().includes(search) ||
        login.deviceId?.toLowerCase().includes(search) ||
        login.userName?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Get unique devices from activities AND logins
  const allDevices = [
    ...activities.map((a) => ({ id: a.deviceId, name: a.deviceName })),
    ...logins.map((l) => ({ id: l.deviceId, name: l.deviceName })),
  ];
  const uniqueDevices = [
    ...new Map(allDevices.map((d) => [d.id, d])).values(),
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Maintenance Logs</h1>
          <p className="text-sm text-muted-foreground">
            View all maintenance activities
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="logins" className="gap-2">
              <LogIn className="h-4 w-4" />
              Login History ({logins.length})
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-2">
              <Wrench className="h-4 w-4" />
              Activities ({activities.length})
            </TabsTrigger>
          </TabsList>

          {/* Login History Tab */}
          <TabsContent value="logins">
            {/* Login Summary Cards */}
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <Card
                className={`cursor-pointer transition-colors ${loginTypeFilter === "driver" ? "ring-2 ring-orange-500" : ""}`}
                onClick={() => setLoginTypeFilter(loginTypeFilter === "driver" ? "all" : "driver")}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                      <Truck className="h-5 w-5 text-orange-600" />
                    </div>
                    <span className="font-medium">Driver</span>
                  </div>
                  <span className="text-2xl font-bold">{loginTypeCounts.driver}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${loginTypeFilter === "maintenance" ? "ring-2 ring-blue-500" : ""}`}
                onClick={() => setLoginTypeFilter(loginTypeFilter === "maintenance" ? "all" : "maintenance")}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Wrench className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-medium">Maintenance</span>
                  </div>
                  <span className="text-2xl font-bold">{loginTypeCounts.maintenance}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${loginTypeFilter === "admin" ? "ring-2 ring-purple-500" : ""}`}
                onClick={() => setLoginTypeFilter(loginTypeFilter === "admin" ? "all" : "admin")}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                      <Shield className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="font-medium">Admin</span>
                  </div>
                  <span className="text-2xl font-bold">{loginTypeCounts.admin}</span>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <LogIn className="h-5 w-5 text-gray-600" />
                    </div>
                    <span className="font-medium">Total Logins</span>
                  </div>
                  <span className="text-2xl font-bold">{logins.length}</span>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
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

                  {(loginTypeFilter !== "all" || deviceFilter !== "all" || searchText) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-1 h-4 w-4" />
                      Clear
                    </Button>
                  )}

                  <span className="ml-auto text-sm text-muted-foreground">
                    {filteredLogins.length} of {logins.length} logins
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Logins Table */}
            <Card>
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
                    {filteredLogins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No login records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogins.map((login) => (
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
            </Card>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities">
            {/* Activity Summary Cards */}
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <Card
                className={`cursor-pointer transition-colors ${typeFilter === "clean_wash" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setTypeFilter(typeFilter === "clean_wash" ? "all" : "clean_wash")}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Wrench className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-medium">Clean/Wash</span>
                  </div>
                  <span className="text-2xl font-bold">{typeCounts.clean_wash}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${typeFilter === "customer_feedback" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setTypeFilter(typeFilter === "customer_feedback" ? "all" : "customer_feedback")}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="font-medium">Feedback</span>
                  </div>
                  <span className="text-2xl font-bold">{typeCounts.customer_feedback}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${statusFilter === "in_progress" ? "ring-2 ring-blue-500" : ""}`}
                onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <span className="font-medium">In Progress</span>
                  </div>
                  <span className="text-2xl font-bold">{statusCounts.in_progress}</span>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${statusFilter === "completed" ? "ring-2 ring-green-500" : ""}`}
                onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="font-medium">Completed</span>
                  </div>
                  <span className="text-2xl font-bold">{statusCounts.completed}</span>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
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

            {/* Activities Table */}
            <Card>
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
