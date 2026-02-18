"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import {
  BarChart3,
  RefreshCw,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Sparkles,
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
import { Progress } from "@/components/ui/progress";

export default function EfficiencyPage() {
  const { isLoaded } = useUser();
  const { isAdmin } = useUserRoles();

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("week");
  const [exporting, setExporting] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (isLoaded && !isAdmin) {
      redirect("/dashboard/operations");
    }
  }, [isLoaded, isAdmin]);

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  async function fetchMetrics() {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/efficiency/metrics?period=${period}`);
      const data = await res.json();

      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
      toast.error("Failed to fetch metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchMetrics();
  }

  async function handleExport(format) {
    try {
      setExporting(true);
      const res = await fetch(`/api/efficiency/export?period=${period}&format=${format}`);

      if (format === "json") {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `incidents-export-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `incidents-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
      }

      toast.success("Export downloaded");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Efficiency Dashboard</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              KPIs and performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Export</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Key Metrics */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Total Incidents</span>
              </div>
              <p className="text-3xl font-bold">{metrics?.totalIncidents || 0}</p>
              <p className="text-xs text-muted-foreground">
                {metrics?.resolvedCount || 0} resolved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">SLA Compliance</span>
              </div>
              <p className="text-3xl font-bold">
                {metrics?.slaCompliance?.complianceRate?.toFixed(1) || 0}%
              </p>
              <Progress
                value={metrics?.slaCompliance?.complianceRate || 0}
                className="h-2 mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">Avg Response</span>
              </div>
              <p className="text-3xl font-bold">
                {metrics?.responseTimes?.avgResponseMinutes || 0}m
              </p>
              <p className="text-xs text-muted-foreground">Time to acknowledge</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Avg Resolution</span>
              </div>
              <p className="text-3xl font-bold">
                {metrics?.responseTimes?.avgResolutionMinutes
                  ? metrics.responseTimes.avgResolutionMinutes < 60
                    ? `${metrics.responseTimes.avgResolutionMinutes}m`
                    : `${Math.round(metrics.responseTimes.avgResolutionMinutes / 60)}h`
                  : "0m"}
              </p>
              <p className="text-xs text-muted-foreground">Time to resolve</p>
            </CardContent>
          </Card>
        </div>

        {/* SLA Breakdown */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">Within SLA</span>
                  </div>
                  <span className="font-medium">{metrics?.slaCompliance?.withinSla || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">Breached</span>
                  </div>
                  <span className="font-medium">{metrics?.slaCompliance?.breached || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Pending</span>
                  </div>
                  <span className="font-medium">{metrics?.slaCompliance?.pending || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Cleaning Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Compliance Rate</span>
                  <span className="font-medium">
                    {metrics?.cleaningCompliance?.complianceRate?.toFixed(1) || 0}%
                  </span>
                </div>
                <Progress
                  value={metrics?.cleaningCompliance?.complianceRate || 0}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {metrics?.cleaningCompliance?.compliantDevices || 0} compliant
                  </span>
                  <span>
                    {metrics?.cleaningCompliance?.totalDevices || 0} total devices
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* By Type Breakdown - Desktop */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="text-base">Incidents by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 text-right">Within SLA</th>
                    <th className="pb-2 text-right">Breached</th>
                    <th className="pb-2 text-right">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metrics?.byType || {}).map(([type, data]) => (
                    <tr key={type} className="border-b last:border-0">
                      <td className="py-3">
                        <Badge variant="outline">{type.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="py-3 text-right font-medium">{data.total}</td>
                      <td className="py-3 text-right text-green-600">{data.withinSla}</td>
                      <td className="py-3 text-right text-red-600">{data.breach}</td>
                      <td className="py-3 text-right">
                        <Badge
                          className={
                            data.complianceRate >= 90
                              ? "bg-green-100 text-green-800"
                              : data.complianceRate >= 70
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {data.complianceRate.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* By Type Breakdown - Mobile */}
        <div className="md:hidden space-y-3">
          <h3 className="font-semibold text-base">Incidents by Type</h3>
          {Object.entries(metrics?.byType || {}).map(([type, data]) => (
            <Card
              key={type}
              className={`border-l-4 ${
                data.complianceRate >= 90
                  ? "border-l-green-500"
                  : data.complianceRate >= 70
                  ? "border-l-yellow-500"
                  : "border-l-red-500"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <Badge variant="outline">{type.replace(/_/g, " ")}</Badge>
                  <Badge
                    className={
                      data.complianceRate >= 90
                        ? "bg-green-100 text-green-800"
                        : data.complianceRate >= 70
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {data.complianceRate.toFixed(0)}%
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold">{data.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-600">{data.withinSla}</p>
                    <p className="text-xs text-muted-foreground">Within SLA</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-red-600">{data.breach}</p>
                    <p className="text-xs text-muted-foreground">Breached</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
