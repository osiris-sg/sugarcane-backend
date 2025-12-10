"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Menu, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const mockDevices = [
  { id: "852259", name: "Pacman Sentosa Event 259" },
  { id: "852283", name: "Pacman Sentosa Event 283" },
  { id: "852286", name: "Pacman Sentosa Event 286" },
  { id: "852277", name: "Pacman Sentosa Event 277" },
  { id: "852279", name: "Pacman Sentosa Event 279" },
  { id: "852309", name: "Pacman Sentosa Event 309" },
];

const mockMenu = {
  items: [
    { id: 1, name: "Sugarcane Juice", price: 3.80, active: true },
  ],
  lastUpdated: "2024-01-15 10:30",
};

export default function SalesMenuPage() {
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [price, setPrice] = useState(mockMenu.items[0].price.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Sales Menu</h1>
          <p className="text-sm text-muted-foreground">Configure pricing for vending machines</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </header>

      <main className="p-6">
        {/* Device Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Select Device</CardTitle>
            <CardDescription>
              Choose a device to configure or select "All Devices" for bulk update
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {mockDevices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Menu Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Menu className="h-4 w-4" />
                  Menu Items
                </CardTitle>
                <CardDescription>
                  Last updated: {mockMenu.lastUpdated}
                </CardDescription>
              </div>
              <Badge variant="outline">
                {selectedDevice === "all" ? "Bulk Edit" : `Device ${selectedDevice}`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {mockMenu.items.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <Badge variant={item.active ? "success" : "secondary"} className="mt-1">
                        {item.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price (SGD)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.10"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="max-w-[150px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Current Price</Label>
                      <p className="text-2xl font-bold text-primary">
                        SGD {parseFloat(price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Device Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-muted-foreground">ID: {device.id}</p>
                  </div>
                  <Badge variant="success">Synced</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
