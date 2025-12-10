"use client";

import { BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const mockSummary = {
  totalFaults: 45,
  resolved: 38,
  mttr: "2.5 hours", // Mean Time To Repair
  topFaultCodes: [
    { code: "E001", description: "Motor jam", count: 12 },
    { code: "W003", description: "Low stock", count: 18 },
    { code: "E002", description: "Payment error", count: 8 },
    { code: "I005", description: "Maintenance due", count: 7 },
  ],
  deviceFaults: [
    { deviceId: "852286", faults: 8 },
    { deviceId: "852259", faults: 6 },
    { deviceId: "852283", faults: 5 },
  ],
};

export default function FaultSummaryPage() {
  const resolutionRate = (mockSummary.resolved / mockSummary.totalFaults) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Fault Summary</h1>
          <p className="text-sm text-muted-foreground">Analytics and trends for fault management</p>
        </div>
      </header>

      <main className="p-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Total Faults (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{mockSummary.totalFaults}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Resolution Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{resolutionRate.toFixed(1)}%</span>
              <Progress value={resolutionRate} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Avg. Resolution Time</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{mockSummary.mttr}</span>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Fault Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Top Fault Codes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockSummary.topFaultCodes.map((fault) => (
                  <div key={fault.code} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <code className="rounded bg-muted px-2 py-1 text-sm">{fault.code}</code>
                      <span className="text-sm">{fault.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(fault.count / mockSummary.totalFaults) * 100}
                        className="w-24"
                      />
                      <span className="text-sm font-medium w-8">{fault.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Devices with Most Faults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Devices with Most Faults
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockSummary.deviceFaults.map((device, index) => (
                  <div key={device.deviceId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {index + 1}
                      </div>
                      <span className="font-mono">{device.deviceId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(device.faults / mockSummary.totalFaults) * 100}
                        className="w-24"
                      />
                      <span className="text-sm font-medium w-8">{device.faults}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
