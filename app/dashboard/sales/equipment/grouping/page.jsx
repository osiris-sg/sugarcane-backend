"use client";

export const dynamic = "force-dynamic";

import { Layers, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const mockGroups = [
  { name: "Sentosa Event", deviceCount: 6, status: "active" },
  { name: "Marina Bay", deviceCount: 0, status: "inactive" },
];

export default function EquipmentGroupingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Equipment Grouping</h1>
          <p className="text-sm text-muted-foreground">Organize devices into logical groups</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </header>

      <main className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockGroups.map((group) => (
            <Card key={group.name} className="cursor-pointer hover:border-primary/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {group.deviceCount} devices
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
