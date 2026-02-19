"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  Layers,
  Plus,
  Trash2,
  Monitor,
  Search,
  Users,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DeviceGroupingPage() {
  const { isLoaded } = useUser();
  const { isAdmin, isLoaded: rolesLoaded } = useUserRoles();

  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [savingDevices, setSavingDevices] = useState({});
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // Redirect non-admins
  if (isLoaded && rolesLoaded && !isAdmin) {
    redirect("/dashboard/sales");
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, devicesRes] = await Promise.all([
        fetch("/api/admin/groups"),
        fetch("/api/admin/devices"),
      ]);
      const groupsData = await groupsRes.json();
      const devicesData = await devicesRes.json();

      if (groupsData.groups) {
        // Sort groups by name
        const sortedGroups = [...groupsData.groups].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setGroups(sortedGroups);
      }
      if (devicesData.devices) {
        // Add assignedGroupIds to each device
        const devicesWithGroups = devicesData.devices.map((device) => ({
          ...device,
          assignedGroupIds: device.allGroups?.map((g) => g.id) || [],
        }));
        setDevices(devicesWithGroups);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewGroupName("");
        setCreateDialogOpen(false);
        toast.success("Group created");
        fetchData();
      } else {
        toast.error(data.error || "Error creating group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    }
  };

  const deleteGroup = async (groupId, groupName) => {
    if (!confirm(`Delete "${groupName}"? Devices will be unassigned from this group.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/groups?id=${groupId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Group deleted");
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    }
  };

  const toggleGroupAssignment = async (deviceId, groupId, isCurrentlyAssigned) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

    setSavingDevices((prev) => ({ ...prev, [deviceId + groupId]: true }));

    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.deviceId,
          ...(isCurrentlyAssigned
            ? { removeFromGroupId: groupId }
            : { groupId: groupId }),
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Update local state
        setDevices((prev) =>
          prev.map((d) => {
            if (d.id === deviceId) {
              const newGroupIds = isCurrentlyAssigned
                ? d.assignedGroupIds.filter((id) => id !== groupId)
                : [...d.assignedGroupIds, groupId];
              return { ...d, assignedGroupIds: newGroupIds };
            }
            return d;
          })
        );
      } else {
        toast.error(data.error || "Failed to update assignment");
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to update assignment");
    } finally {
      setSavingDevices((prev) => ({ ...prev, [deviceId + groupId]: false }));
    }
  };

  const filteredDevices = devices.filter((d) => {
    // Filter by search term
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      d.deviceId?.toLowerCase().includes(search) ||
      d.deviceName?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search);

    // Filter by selected group
    const matchesGroup = selectedGroupId
      ? d.assignedGroupIds.includes(selectedGroupId)
      : true;

    return matchesSearch && matchesGroup;
  });

  // Group devices by whether they have assignments
  const assignedDevices = filteredDevices.filter((d) => d.assignedGroupIds.length > 0);
  const unassignedDevices = filteredDevices.filter((d) => d.assignedGroupIds.length === 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Device Grouping</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {groups.length} groups, {devices.length} devices ({unassignedDevices.length} unassigned)
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">New Group</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">Group Name (Franchisee)</Label>
                  <Input
                    id="groupName"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g., Jeffrey, Trevors"
                    onKeyDown={(e) => e.key === "Enter" && createGroup()}
                  />
                </div>
                <Button onClick={createGroup} className="w-full">
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {/* Groups Legend */}
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Franchisee Groups
              {selectedGroupId && (
                <button
                  onClick={() => setSelectedGroupId(null)}
                  className="text-xs text-primary hover:underline ml-2"
                >
                  Clear filter
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No groups yet. Click "New Group" to create one.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => {
                  const isSelected = selectedGroupId === group.id;

                  return (
                    <div
                      key={group.id}
                      className="flex items-center gap-2 group"
                    >
                      <button
                        onClick={() => setSelectedGroupId(isSelected ? null : group.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        <Layers className={`h-4 w-4 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        <span>{group.name}</span>
                        <Badge
                          variant={isSelected ? "secondary" : "outline"}
                          className={`text-xs ${isSelected ? "bg-primary-foreground/20 text-primary-foreground border-0" : ""}`}
                        >
                          {group.deviceCount || 0}
                        </Badge>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteGroup(group.id, group.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Devices List */}
        <div className="space-y-6">
          {/* Unassigned Devices Section */}
          {unassignedDevices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Unassigned Devices ({unassignedDevices.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unassignedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    groups={groups}
                    savingDevices={savingDevices}
                    onToggle={toggleGroupAssignment}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Assigned Devices Section */}
          {assignedDevices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Assigned Devices ({assignedDevices.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assignedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    groups={groups}
                    savingDevices={savingDevices}
                    onToggle={toggleGroupAssignment}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No devices message */}
          {filteredDevices.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Monitor className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No devices found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function DeviceCard({ device, groups, savingDevices, onToggle }) {
  return (
    <Card className={device.assignedGroupIds.length === 0 ? "border-destructive/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              {device.location || device.deviceName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              ID: {device.deviceId}
            </p>
          </div>
          <Badge variant={device.assignedGroupIds.length > 0 ? "secondary" : "destructive"}>
            {device.assignedGroupIds.length} group{device.assignedGroupIds.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No groups available
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const isAssigned = device.assignedGroupIds.includes(group.id);
              const isSaving = savingDevices[device.id + group.id];

              return (
                <label
                  key={group.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isAssigned ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Checkbox
                      checked={isAssigned}
                      onCheckedChange={() =>
                        onToggle(device.id, group.id, isAssigned)
                      }
                    />
                  )}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{group.name}</span>
                  </div>
                  {isAssigned && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
