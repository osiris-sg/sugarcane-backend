"use client";

import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockSummary = {
  today: { orders: 45, revenue: 171.00, change: 12.5 },
  week: { orders: 312, revenue: 1185.60, change: -3.2 },
  month: { orders: 1248, revenue: 4742.40, change: 8.7 },
};

export default function OrderSummaryPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Order Summary</h1>
          <p className="text-sm text-muted-foreground">Sales performance overview</p>
        </div>
      </header>

      <main className="p-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Today */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">SGD {mockSummary.today.revenue.toFixed(2)}</span>
                  <span className={`flex items-center text-sm ${mockSummary.today.change > 0 ? "text-green-500" : "text-red-500"}`}>
                    {mockSummary.today.change > 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                    {Math.abs(mockSummary.today.change)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{mockSummary.today.orders} orders</p>
              </div>
            </CardContent>
          </Card>

          {/* This Week */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">SGD {mockSummary.week.revenue.toFixed(2)}</span>
                  <span className={`flex items-center text-sm ${mockSummary.week.change > 0 ? "text-green-500" : "text-red-500"}`}>
                    {mockSummary.week.change > 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                    {Math.abs(mockSummary.week.change)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{mockSummary.week.orders} orders</p>
              </div>
            </CardContent>
          </Card>

          {/* This Month */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">SGD {mockSummary.month.revenue.toFixed(2)}</span>
                  <span className={`flex items-center text-sm ${mockSummary.month.change > 0 ? "text-green-500" : "text-red-500"}`}>
                    {mockSummary.month.change > 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                    {Math.abs(mockSummary.month.change)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{mockSummary.month.orders} orders</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Placeholder */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">Sales chart will be displayed here</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
