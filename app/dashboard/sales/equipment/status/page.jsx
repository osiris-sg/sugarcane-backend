"use client";

export const dynamic = "force-dynamic";

import { Activity, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const mockStatus = {
  online: 5,
  offline: 1,
  maintenance: 0,
  total: 6,
};

export default function EquipmentStatusPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Equipment Status</h1>
          <p className="text-sm text-muted-foreground">Real-time device status overview</p>
        </div>
      </header>

      <main className="p-6">
        {/* Status Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                <span>Online</span>
              </div>
              <span className="text-2xl font-bold">{mockStatus.online}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                <span>Offline</span>
              </div>
              <span className="text-2xl font-bold">{mockStatus.offline}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                <span>Maintenance</span>
              </div>
              <span className="text-2xl font-bold">{mockStatus.maintenance}</span>
            </CardContent>
          </Card>
        </div>

        {/* Uptime */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Fleet Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Uptime</span>
                <span className="font-medium">
                  {((mockStatus.online / mockStatus.total) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={(mockStatus.online / mockStatus.total) * 100} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
