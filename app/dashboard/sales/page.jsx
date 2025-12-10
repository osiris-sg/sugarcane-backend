"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  RotateCcw,
  Calendar,
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

// Mock data - will be replaced with real API data
const mockData = {
  payments: {
    succeeded: 156,
    refunded: 3,
    failed: 2,
    total: 161,
  },
  grossVolume: {
    amount: 6010.75,
    change: 2.8,
    isPositive: true,
    data: [4200, 4800, 5100, 4900, 5500, 5800, 6010],
  },
  netVolume: {
    amount: 3677.42,
    change: -16.75,
    isPositive: false,
    data: [3800, 4100, 4300, 4000, 3900, 3800, 3677],
  },
  failedPayments: [
    { id: "PAY-001", amount: 8.00, date: "2 hours ago", reason: "Card declined" },
    { id: "PAY-002", amount: 8.00, date: "5 hours ago", reason: "Insufficient funds" },
  ],
  newCustomers: {
    count: 0,
    data: [5, 8, 3, 12, 7, 4, 0],
  },
  topCustomers: [
    { name: "Customer A", email: "a@email.com", spend: 3034.50 },
    { name: "Customer B", email: "b@email.com", spend: 2122.00 },
    { name: "Customer C", email: "c@email.com", spend: 854.25 },
  ],
};

function MiniLineChart({ data, color = "#22c55e", height = 40 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">Succeeded</span>
          <span className="font-medium">{succeeded}</span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-yellow-500" />
          <span className="text-muted-foreground">Refunded</span>
          <span className="font-medium">{refunded}</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-muted-foreground">Failed</span>
          <span className="font-medium">{failed}</span>
        </div>
      </div>
    </div>
  );
}

export default function SalesOverviewPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [interval, setInterval] = useState("daily");
  const [compareEnabled, setCompareEnabled] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-semibold">Sales Overview</h1>
            <p className="text-sm text-muted-foreground">
              Track revenue, payments, and customer activity
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 border-t bg-muted/30 px-6 py-3">
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
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
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
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Top Row - Payments and Volume */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Payments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentStatusBar {...mockData.payments} />
            </CardContent>
          </Card>

          {/* Gross Volume */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Gross Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  SGD {mockData.grossVolume.amount.toLocaleString("en-SG", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`flex items-center text-sm ${
                    mockData.grossVolume.isPositive
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {mockData.grossVolume.isPositive ? (
                    <TrendingUp className="mr-1 h-4 w-4" />
                  ) : (
                    <TrendingDown className="mr-1 h-4 w-4" />
                  )}
                  {mockData.grossVolume.change}%
                </span>
              </div>
              <div className="mt-4">
                <MiniLineChart
                  data={mockData.grossVolume.data}
                  color={mockData.grossVolume.isPositive ? "#22c55e" : "#ef4444"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Net Volume */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Net Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  SGD {mockData.netVolume.amount.toLocaleString("en-SG", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`flex items-center text-sm ${
                    mockData.netVolume.isPositive
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {mockData.netVolume.isPositive ? (
                    <TrendingUp className="mr-1 h-4 w-4" />
                  ) : (
                    <TrendingDown className="mr-1 h-4 w-4" />
                  )}
                  {Math.abs(mockData.netVolume.change)}%
                </span>
              </div>
              <div className="mt-4">
                <MiniLineChart
                  data={mockData.netVolume.data}
                  color={mockData.netVolume.isPositive ? "#22c55e" : "#ef4444"}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Failed Payments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Failed Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockData.failedPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No failed payments in this period
                  </p>
                ) : (
                  mockData.failedPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          SGD {payment.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.reason}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {payment.date}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* New Customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">New Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {mockData.newCustomers.count}
                </span>
                <span className="text-sm text-muted-foreground">this period</span>
              </div>
              <div className="mt-4">
                <MiniLineChart
                  data={mockData.newCustomers.data}
                  color="#3b82f6"
                />
              </div>
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Top Customers by Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockData.topCustomers.map((customer, index) => (
                  <div
                    key={customer.email}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.email}
                        </p>
                      </div>
                    </div>
                    <span className="font-medium">
                      SGD {customer.spend.toLocaleString("en-SG", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base font-medium">Period Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{mockData.payments.total}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {((mockData.payments.succeeded / mockData.payments.total) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Avg Transaction</p>
                <p className="text-2xl font-bold">
                  SGD {(mockData.grossVolume.amount / mockData.payments.succeeded).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Refund Rate</p>
                <p className="text-2xl font-bold">
                  {((mockData.payments.refunded / mockData.payments.total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
