"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  RotateCcw,
  Calendar,
  Monitor,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// Helper to get date range based on filter
function getDateRange(dateRange) {
  const now = new Date();
  let days = 7;
  switch (dateRange) {
    case "24h": days = 1; break;
    case "7d": days = 7; break;
    case "30d": days = 30; break;
    case "90d": days = 90; break;
    default: days = 7;
  }
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  return { startDate, endDate: now, days };
}

// Custom tooltip for revenue chart with period comparison
function RevenueChartTooltip({ active, payload, label, compareEnabled, metric = "Gross volume" }) {
  if (!active || !payload || payload.length === 0) return null;

  const current = payload.find(p => p.dataKey === "current");
  const previous = payload.find(p => p.dataKey === "previous");

  // Calculate percentage change
  let percentChange = null;
  if (current?.value != null && previous?.value != null && previous.value > 0) {
    percentChange = ((current.value - previous.value) / previous.value * 100).toFixed(2);
  }

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 min-w-[180px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{metric}</span>
        {percentChange !== null && (
          <span className={`text-sm font-medium ${parseFloat(percentChange) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {parseFloat(percentChange) >= 0 ? '+' : ''}{percentChange}%
          </span>
        )}
      </div>
      {current && (
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-violet-500" />
          <span className="text-xs text-gray-500">{current.payload.currentLabel}</span>
          <span className="text-sm font-semibold ml-auto">${current.value?.toFixed(2)}</span>
        </div>
      )}
      {compareEnabled && previous && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-xs text-gray-500">{previous.payload.previousLabel}</span>
          <span className="text-sm font-semibold ml-auto text-gray-500">${previous.value?.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// Revenue Line Chart component
function RevenueChart({ data, compareEnabled, height = 200 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No data available
      </div>
    );
  }

  // Get min and max for Y axis
  const allValues = data.flatMap(d => [d.current, compareEnabled ? d.previous : null].filter(v => v != null));
  const maxValue = Math.max(...allValues, 0);
  const yAxisMax = Math.ceil(maxValue / 100) * 100 || 100;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="shortLabel"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          interval="preserveStartEnd"
        />
        <YAxis
          orientation="right"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(value) => value >= 1000 ? `$${(value/1000).toFixed(1)}K` : `$${value}`}
          domain={[0, yAxisMax]}
          width={50}
        />
        <Tooltip content={<RevenueChartTooltip compareEnabled={compareEnabled} />} />
        {/* Previous period line (dashed gray) - render first so it's behind */}
        {compareEnabled && (
          <Line
            type="monotone"
            dataKey="previous"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4, fill: '#9ca3af', stroke: '#fff', strokeWidth: 2 }}
          />
        )}
        {/* Current period line (solid purple) */}
        <Line
          type="monotone"
          dataKey="current"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Skeleton for chart card
function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 px-4 md:px-6">
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <div className="flex items-baseline gap-2 mb-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[180px] w-full" />
      </CardContent>
    </Card>
  );
}

// Skeleton for payment status card
function PaymentCardSkeleton() {
  return (
    <Card className="md:col-span-2 lg:col-span-1">
      <CardHeader className="pb-2 px-4 md:px-6">
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <Skeleton className="h-3 w-full mb-3" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton for stats card
function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 px-4 md:px-6">
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  );
}

// Skeleton for period summary
function SummarySkeleton() {
  return (
    <Card className="mt-4 md:mt-6">
      <CardHeader className="px-4 md:px-6">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-3 md:p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Custom tooltip for Today chart
function TodayChartTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm min-w-[140px]">
      <p className="text-gray-500 font-medium mb-2">{data.timeLabel}</p>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full bg-indigo-500" />
        <span className="text-gray-600">Today</span>
        <span className="font-semibold ml-auto">${data.cumulative?.toFixed(2) || '0.00'}</span>
      </div>
      {data.yesterdayCumulative != null && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-300" />
          <span className="text-gray-500">Yesterday</span>
          <span className="font-semibold ml-auto text-gray-500">${data.yesterdayCumulative?.toFixed(2) || '0.00'}</span>
        </div>
      )}
    </div>
  );
}

// Today's cumulative chart with yesterday comparison
function TodayChart({ data, height = 120 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No data yet
      </div>
    );
  }

  // Get max from both today and yesterday for Y axis
  const allValues = data.flatMap(d => [d.cumulative, d.yesterdayCumulative].filter(v => v != null));
  const maxValue = Math.max(...allValues, 100);
  const yAxisMax = Math.ceil(maxValue / 100) * 100 || 100;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="timeLabel"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          interval="preserveStartEnd"
        />
        <YAxis hide domain={[0, yAxisMax]} />
        <Tooltip content={<TodayChartTooltip />} />
        {/* Yesterday's line (gray, behind) */}
        <Line
          type="monotone"
          dataKey="yesterdayCumulative"
          stroke="#d1d5db"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: '#9ca3af', stroke: '#fff', strokeWidth: 1 }}
        />
        {/* Today's line (purple, front) */}
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PaymentStatusBar({ succeeded, refunded, failed, total }) {
  const succeededWidth = (succeeded / total) * 100;
  const refundedWidth = (refunded / total) * 100;
  const failedWidth = (failed / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${succeededWidth}%` }}
        />
        <div
          className="bg-yellow-500 transition-all"
          style={{ width: `${refundedWidth}%` }}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${failedWidth}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-sm md:gap-4">
        <div className="flex items-center gap-1.5 md:gap-2">
          <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
          <span className="text-muted-foreground text-xs md:text-sm">Succeeded</span>
          <span className="font-medium text-xs md:text-sm">{succeeded}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4 text-yellow-500" />
          <span className="text-muted-foreground text-xs md:text-sm">Refunded</span>
          <span className="font-medium text-xs md:text-sm">{refunded}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />
          <span className="text-muted-foreground text-xs md:text-sm">Failed</span>
          <span className="font-medium text-xs md:text-sm">{failed}</span>
        </div>
      </div>
    </div>
  );
}

export default function SalesOverviewPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [interval, setInterval] = useState("daily");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [salesData, setSalesData] = useState({
    grossVolume: { amount: 0, previousAmount: 0, change: 0, isPositive: true },
    netVolume: { amount: 0, previousAmount: 0, change: 0, isPositive: true },
    payments: { succeeded: 0, refunded: 0, failed: 0, total: 0 },
    chartData: [], // Array of { current, previous, currentLabel, previousLabel, shortLabel }
  });

  // Today's data
  const [todayData, setTodayData] = useState({
    total: 0,
    yesterdayTotal: 0,
    chartData: [],
    currentTime: "",
  });

  useEffect(() => {
    fetchDevices();
    fetchTodayData();
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [dateRange, selectedDevice, interval]);

  async function fetchTodayData() {
    try {
      const res = await fetch("/api/admin/orders?limit=1000");
      const data = await res.json();

      if (data.success) {
        const allOrders = data.orders || [];
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        // Filter successful, non-free orders
        const paidOrders = allOrders.filter(o => o.isSuccess && o.payWay !== "1000");

        // Today's orders
        const todayOrders = paidOrders.filter(o => new Date(o.createdAt) >= todayStart);
        const todaySum = todayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        // Yesterday's orders
        const yesterdayOrders = paidOrders.filter(o => {
          const d = new Date(o.createdAt);
          return d >= yesterdayStart && d < todayStart;
        });
        const yesterdaySum = yesterdayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        // Build hourly totals for today
        const hourlyTotals = {};
        todayOrders.forEach(order => {
          const hour = new Date(order.createdAt).getHours();
          if (!hourlyTotals[hour]) hourlyTotals[hour] = 0;
          hourlyTotals[hour] += order.amount || 0;
        });

        // Build hourly totals for yesterday
        const yesterdayHourlyTotals = {};
        yesterdayOrders.forEach(order => {
          const hour = new Date(order.createdAt).getHours();
          if (!yesterdayHourlyTotals[hour]) yesterdayHourlyTotals[hour] = 0;
          yesterdayHourlyTotals[hour] += order.amount || 0;
        });

        // Create cumulative chart data with both today and yesterday
        const chartData = [];
        let cumulative = 0;
        let yesterdayCumulative = 0;
        const currentHour = now.getHours();
        // Show full 24 hours for yesterday, up to current hour for today
        for (let h = 0; h <= 23; h++) {
          yesterdayCumulative += (yesterdayHourlyTotals[h] || 0) / 100;
          if (h <= currentHour) {
            cumulative += (hourlyTotals[h] || 0) / 100;
          }
          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h < 12 ? 'AM' : 'PM';
          chartData.push({
            hour: h,
            timeLabel: `${hour12}:00 ${ampm}`,
            cumulative: h <= currentHour ? cumulative : null,
            yesterdayCumulative,
          });
        }

        setTodayData({
          total: todaySum / 100,
          yesterdayTotal: yesterdaySum / 100,
          chartData,
          currentTime: now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
        });
      }
    } catch (error) {
      console.error("Error fetching today's data:", error);
    }
  }

  async function fetchDevices() {
    try {
      const res = await fetch("/api/admin/devices");
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  }

  async function fetchSalesData() {
    setLoading(true);
    try {
      const { startDate, endDate, days } = getDateRange(dateRange);

      // Build query params
      const params = new URLSearchParams({
        period: "custom",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (selectedDevice !== "all") {
        params.set("deviceId", selectedDevice);
      }

      // Fetch current period orders
      const res = await fetch(`/api/admin/orders?${params.toString()}&limit=10000`);
      const data = await res.json();

      if (data.success) {
        const orders = data.orders || [];

        // Only count successful, non-free orders
        const successfulOrders = orders.filter(o => o.isSuccess && o.payWay !== "1000");

        // Calculate gross volume (total successful sales)
        const grossAmount = successfulOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        // Group orders by date for chart
        const dailyTotals = {};
        successfulOrders.forEach(order => {
          const date = new Date(order.createdAt).toISOString().split('T')[0];
          if (!dailyTotals[date]) {
            dailyTotals[date] = 0;
          }
          dailyTotals[date] += order.amount || 0;
        });

        // Fetch previous period for comparison
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - days);
        const prevParams = new URLSearchParams({
          period: "custom",
          startDate: prevStartDate.toISOString(),
          endDate: startDate.toISOString(),
        });
        if (selectedDevice !== "all") {
          prevParams.set("deviceId", selectedDevice);
        }

        const prevRes = await fetch(`/api/admin/orders?${prevParams.toString()}&limit=10000`);
        const prevData = await prevRes.json();
        const prevOrders = (prevData.orders || []).filter(o => o.isSuccess && o.payWay !== "1000");
        const prevGrossAmount = prevOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

        // Group previous period orders by date
        const prevDailyTotals = {};
        prevOrders.forEach(order => {
          const date = new Date(order.createdAt).toISOString().split('T')[0];
          if (!prevDailyTotals[date]) {
            prevDailyTotals[date] = 0;
          }
          prevDailyTotals[date] += order.amount || 0;
        });

        // Create aligned chart data for both periods
        const chartData = [];
        const formatLabel = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        if (interval === 'weekly') {
          // Aggregate by week
          const numWeeks = Math.ceil(days / 7);
          for (let w = 0; w < numWeeks; w++) {
            let currentWeekTotal = 0;
            let previousWeekTotal = 0;
            let weekStartDate = new Date(startDate);
            weekStartDate.setDate(weekStartDate.getDate() + (w * 7));
            let prevWeekStartDate = new Date(prevStartDate);
            prevWeekStartDate.setDate(prevWeekStartDate.getDate() + (w * 7));

            // Sum up 7 days for each week
            for (let d = 0; d < 7; d++) {
              const dayOffset = w * 7 + d;
              if (dayOffset >= days) break;

              const currentDate = new Date(startDate);
              currentDate.setDate(currentDate.getDate() + dayOffset);
              const currentDateStr = currentDate.toISOString().split('T')[0];
              currentWeekTotal += dailyTotals[currentDateStr] || 0;

              const previousDate = new Date(prevStartDate);
              previousDate.setDate(previousDate.getDate() + dayOffset);
              const previousDateStr = previousDate.toISOString().split('T')[0];
              previousWeekTotal += prevDailyTotals[previousDateStr] || 0;
            }

            // Week end date for label
            let weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekEndDate.getDate() + 6);
            if (weekEndDate > endDate) weekEndDate = endDate;

            let prevWeekEndDate = new Date(prevWeekStartDate);
            prevWeekEndDate.setDate(prevWeekEndDate.getDate() + 6);

            chartData.push({
              current: currentWeekTotal / 100,
              previous: previousWeekTotal / 100,
              currentLabel: `${formatLabel(weekStartDate)} - ${formatLabel(weekEndDate)}`,
              previousLabel: `${formatLabel(prevWeekStartDate)} - ${formatLabel(prevWeekEndDate)}`,
              shortLabel: formatLabel(weekStartDate),
            });
          }
        } else {
          // Daily - one point per day
          for (let i = 0; i < days; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + i);
            const currentDateStr = currentDate.toISOString().split('T')[0];

            const previousDate = new Date(prevStartDate);
            previousDate.setDate(previousDate.getDate() + i);
            const previousDateStr = previousDate.toISOString().split('T')[0];

            chartData.push({
              current: (dailyTotals[currentDateStr] || 0) / 100,
              previous: (prevDailyTotals[previousDateStr] || 0) / 100,
              currentLabel: formatLabel(currentDate),
              previousLabel: formatLabel(previousDate),
              shortLabel: formatLabel(currentDate),
            });
          }
        }

        // Calculate change percentage
        let changePercent = 0;
        if (prevGrossAmount > 0) {
          changePercent = ((grossAmount - prevGrossAmount) / prevGrossAmount) * 100;
        } else if (grossAmount > 0) {
          changePercent = 100;
        }

        setSalesData({
          grossVolume: {
            amount: grossAmount / 100,
            previousAmount: prevGrossAmount / 100,
            change: Math.abs(changePercent).toFixed(1),
            isPositive: changePercent >= 0,
          },
          netVolume: {
            amount: grossAmount / 100,
            previousAmount: prevGrossAmount / 100,
            change: Math.abs(changePercent).toFixed(1),
            isPositive: changePercent >= 0,
          },
          payments: {
            succeeded: successfulOrders.length,
            refunded: 0,
            failed: orders.filter(o => !o.isSuccess).length,
            total: orders.length,
          },
          chartData,
        });
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background md:top-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Sales Analytics</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Track revenue, payments, and customer activity
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-6">
        {/* Today Section */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 md:gap-10 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Gross volume</p>
                <p className="text-2xl md:text-3xl font-bold">
                  ${todayData.total.toLocaleString("en-SG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">{todayData.currentTime}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Yesterday</p>
                <p className="text-2xl md:text-3xl font-bold text-muted-foreground">
                  ${todayData.yesterdayTotal.toLocaleString("en-SG", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="h-[120px] md:h-[150px]">
              <TodayChart data={todayData.chartData} height={120} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>12:00 AM</span>
              <span>11:59 PM</span>
            </div>
          </CardContent>
        </Card>

        {/* Filters Section */}
        <div className="mb-4 md:mb-6">
          {/* Mobile Filters */}
          <div className="md:hidden">
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between mb-3">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Device" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Devices</SelectItem>
                      {devices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.location || device.deviceName || device.deviceId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={interval} onValueChange={setInterval}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={compareEnabled ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => setCompareEnabled(!compareEnabled)}
                  >
                    Compare
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Desktop Filters */}
          <div className="hidden md:flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.location || device.deviceName || device.deviceId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={compareEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setCompareEnabled(!compareEnabled)}
            >
              Compare to previous
            </Button>
          </div>
        </div>

        {loading ? (
          <>
            {/* Loading Skeletons */}
            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              <PaymentCardSkeleton />
              <ChartCardSkeleton />
            </div>
            <div className="mt-4 md:mt-6 grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </div>
            <SummarySkeleton />
          </>
        ) : (
          <>
        {/* Top Row - Payments and Volume */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {/* Payments */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Payments</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <PaymentStatusBar {...salesData.payments} />
            </CardContent>
          </Card>

          {/* Gross Volume */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Gross Volume</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl md:text-2xl font-bold">
                  ${salesData.grossVolume.amount.toLocaleString("en-SG", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                {salesData.grossVolume.change > 0 && (
                  <span
                    className={`flex items-center text-xs md:text-sm ${
                      salesData.grossVolume.isPositive
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {salesData.grossVolume.isPositive ? (
                      <TrendingUp className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                    )}
                    {salesData.grossVolume.change}%
                  </span>
                )}
              </div>
              {compareEnabled && salesData.grossVolume.previousAmount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  ${salesData.grossVolume.previousAmount.toLocaleString("en-SG", { minimumFractionDigits: 2 })} previous period
                </p>
              )}
              <div className="mt-3 md:mt-4">
                <RevenueChart
                  data={salesData.chartData}
                  compareEnabled={compareEnabled}
                  height={180}
                />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Bottom Row */}
        <div className="mt-4 md:mt-6 grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Failed Payments */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Failed Payments</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-3">
                <p className="text-xs md:text-sm text-muted-foreground">
                  No failed payments tracked
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Orders by Payment Method */}
          <Card>
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold">
                  {salesData.payments.succeeded}
                </span>
                <span className="text-xs md:text-sm text-muted-foreground">total orders</span>
              </div>
              <p className="mt-2 text-xs md:text-sm text-muted-foreground">
                Cash & card payments combined
              </p>
            </CardContent>
          </Card>

          {/* Top Devices */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2 px-4 md:px-6">
              <CardTitle className="text-sm md:text-base font-medium">
                Selected Device
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-3">
                {selectedDevice === "all" ? (
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Showing all devices. Select a specific device to see details.
                  </p>
                ) : (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="font-medium text-sm md:text-base">
                      {devices.find(d => d.deviceId === selectedDevice)?.deviceName || selectedDevice}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {salesData.payments.succeeded} orders · ${salesData.grossVolume.amount.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Summary */}
        <Card className="mt-4 md:mt-6">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="text-sm md:text-base font-medium">Period Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Transactions</p>
                <p className="text-lg md:text-2xl font-bold">{salesData.payments.total}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Success Rate</p>
                <p className="text-lg md:text-2xl font-bold">
                  {salesData.payments.total > 0
                    ? ((salesData.payments.succeeded / salesData.payments.total) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Avg Order</p>
                <p className="text-lg md:text-2xl font-bold">
                  ${salesData.payments.succeeded > 0
                    ? (salesData.grossVolume.amount / salesData.payments.succeeded).toFixed(2)
                    : "0.00"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground">Total Cups</p>
                <p className="text-lg md:text-2xl font-bold">
                  {salesData.payments.succeeded}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </main>
    </div>
  );
}
