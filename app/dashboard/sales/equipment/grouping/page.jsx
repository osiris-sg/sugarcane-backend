"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Layers,
  Plus,
  Trash2,
  Monitor,
  ChevronDown,
  ChevronRight,
  GripVertical,
  X,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Draggable device component
function DraggableDevice({ device, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: device.id,
    data: { device },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        cursor: "grab",
      }
    : { cursor: "grab" };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

// Droppable group component
function DroppableGroup({ group, children, isOver }) {
  const { setNodeRef } = useDroppable({
    id: group.id,
    data: { group },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 ${
        isOver ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""
      }`}
    >
      {children}
    </div>
  );
}

export default function DeviceGroupingPage() {
  const { user, isLoaded } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin" || role === "finance";

  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [newGroupName, setNewGroupName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogSearchTerm, setDialogSearchTerm] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  // Redirect non-admins
  if (isLoaded && !isAdmin) {
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
        // Sort groups by device count (highest first)
        const sortedGroups = [...groupsData.groups].sort(
          (a, b) => (b.deviceCount || 0) - (a.deviceCount || 0)
        );
        setGroups(sortedGroups);
        // Expand all groups by default
        const expanded = {};
        sortedGroups.forEach((g) => (expanded[g.id] = true));
        setExpandedGroups(expanded);
      }
      if (devicesData.devices) {
        setDevices(devicesData.devices);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
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
        fetchData();
      } else {
        alert(data.error || "Error creating group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const deleteGroup = async (groupId) => {
    if (!confirm("Are you sure? Devices in this group will be unassigned.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/groups?id=${groupId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  const assignDeviceToGroup = async (deviceId, groupId) => {
    try {
      const device = devices.find((d) => d.id === deviceId);
      if (!device) return;

      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.deviceId,
          groupId: groupId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error assigning device:", error);
    }
  };

  const removeDeviceFromGroup = async (deviceId, groupId) => {
    try {
      const device = devices.find((d) => d.id === deviceId);
      if (!device) return;

      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.deviceId,
          removeFromGroupId: groupId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error removing device from group:", error);
    }
  };

  // Show all devices (many-to-many allows same device in multiple groups)
  const allDevices = devices;

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const deviceId = active.id;
    const groupId = over.id;

    // Check if dropped on a valid group
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    // Assign device to group
    await assignDeviceToGroup(deviceId, groupId);
  };

  const activeDevice = activeId
    ? devices.find((d) => d.id === activeId)
    : null;

  const filteredDevices = allDevices.filter((d) => {
    const search = searchTerm.toLowerCase();
    return (
      d.deviceId?.toLowerCase().includes(search) ||
      d.deviceName?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search)
    );
  });

  // Filter devices for dialog - exclude devices already in the selected group
  const filteredDialogDevices = allDevices.filter((d) => {
    const search = dialogSearchTerm.toLowerCase();
    const matchesSearch =
      d.deviceId?.toLowerCase().includes(search) ||
      d.deviceName?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search);

    // Exclude devices already in the selected group
    const alreadyInGroup = selectedGroup && d.allGroups?.some(g => g.id === selectedGroup.id);

    return matchesSearch && !alreadyInGroup;
  });

  const filteredGroups = groups.filter((g) => {
    const search = groupSearchTerm.toLowerCase();
    if (!search) return true;
    // Search by group name or by devices in the group
    const nameMatch = g.name?.toLowerCase().includes(search);
    const deviceMatch = g.devices?.some(
      (d) =>
        d.deviceId?.toLowerCase().includes(search) ||
        d.deviceName?.toLowerCase().includes(search) ||
        d.location?.toLowerCase().includes(search)
    );
    return nameMatch || deviceMatch;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b bg-background px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Device Grouping</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {groups.length} groups, {devices.length} devices
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
        </header>

        <main className="p-4 md:p-6">
          <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_350px]">
            {/* Groups List */}
            <div className="space-y-4 order-2 lg:order-1">
              <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
                Franchisee Groups
                {activeId && (
                  <Badge variant="outline" className="ml-2 animate-pulse text-xs">
                    Drop here
                  </Badge>
                )}
              </h2>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  className="pl-10"
                  value={groupSearchTerm}
                  onChange={(e) => setGroupSearchTerm(e.target.value)}
                />
              </div>

              {groups.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Layers className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No groups created yet</p>
                    <p className="text-sm">Click "New Group" to create one</p>
                  </CardContent>
                </Card>
              ) : filteredGroups.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No groups match your search</p>
                  </CardContent>
                </Card>
              ) : (
                filteredGroups.map((group) => (
                  <DroppableGroup
                    key={group.id}
                    group={group}
                    isOver={overId === group.id}
                  >
                    <Card
                      className={`transition-all duration-200 ${
                        overId === group.id
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                    >
                      <CardHeader className="pb-2 px-3 md:px-6">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleGroup(group.id)}
                            className="flex items-center gap-1.5 md:gap-2 hover:text-primary transition-colors"
                          >
                            {expandedGroups[group.id] ? (
                              <ChevronDown className="h-4 w-4 md:h-5 md:w-5" />
                            ) : (
                              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
                            )}
                            <CardTitle className="text-sm md:text-base">{group.name}</CardTitle>
                            <Badge variant="secondary" className="text-xs">{group.deviceCount}</Badge>
                          </button>
                          <div className="flex items-center gap-1 md:gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 md:px-3"
                              onClick={() => {
                                setSelectedGroup(group);
                                setAssignDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4 md:mr-1" />
                              <span className="hidden md:inline">Add Device</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteGroup(group.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {expandedGroups[group.id] && (
                        <CardContent className="px-3 md:px-6">
                          {group.devices?.length === 0 ? (
                            <p className={`text-xs md:text-sm text-muted-foreground py-4 text-center ${
                              overId === group.id ? "text-primary font-medium" : ""
                            }`}>
                              {overId === group.id
                                ? "Drop device here!"
                                : "No devices in this group"}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {group.devices?.map((device) => (
                                <div
                                  key={device.id}
                                  className="flex items-center justify-between rounded-lg border p-2 md:p-3 bg-muted/30"
                                >
                                  <div className="flex items-center gap-2 md:gap-3">
                                    <Monitor className="h-4 w-4 text-muted-foreground hidden md:block" />
                                    <div>
                                      <p className="font-medium text-sm">{device.deviceName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {device.location || device.deviceId}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeDeviceFromGroup(device.id, group.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  </DroppableGroup>
                ))
              )}
          </div>

          {/* All Devices */}
            <div className="space-y-4 order-1 lg:order-2">
              <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                <Monitor className="h-4 w-4 md:h-5 md:w-5" />
                All Devices
              </h2>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Card>
                <CardContent className="p-2">
                  {filteredDevices.length === 0 ? (
                    <p className="text-xs md:text-sm text-muted-foreground py-6 md:py-8 text-center">
                      {allDevices.length === 0
                        ? "No devices found"
                        : "No devices match your search"}
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[300px] md:max-h-[500px] overflow-y-auto">
                      {filteredDevices.map((device) => (
                        <DraggableDevice key={device.id} device={device}>
                          <div
                            className={`flex items-center justify-between rounded-lg border p-2 md:p-3 hover:bg-muted/50 transition-colors ${
                              activeId === device.id ? "border-primary bg-primary/10" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 md:gap-3">
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab hidden lg:block" />
                              <div>
                                <p className="font-medium text-sm">{device.deviceName}</p>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <p className="text-xs text-muted-foreground">
                                    {device.location || device.deviceId}
                                  </p>
                                  {device.allGroups?.length > 0 && (
                                    <span className="text-xs text-muted-foreground">•</span>
                                  )}
                                  {device.allGroups?.map((g) => (
                                    <Badge key={g.id} variant="secondary" className="text-[10px] px-1 py-0">
                                      {g.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {groups.length > 0 && (
                              <select
                                className="text-xs md:text-sm border rounded px-1.5 md:px-2 py-1 bg-background"
                                defaultValue=""
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignDeviceToGroup(device.id, e.target.value);
                                    e.target.value = "";
                                  }
                                }}
                              >
                                <option value="">Add to...</option>
                                {groups
                                  .filter((g) => !device.allGroups?.some((dg) => dg.id === g.id))
                                  .map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        </DraggableDevice>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

      {/* Assign Device Dialog */}
        <Dialog
          open={assignDialogOpen}
          onOpenChange={(open) => {
            setAssignDialogOpen(open);
            if (!open) setDialogSearchTerm("");
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Device to {selectedGroup?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  className="pl-10"
                  value={dialogSearchTerm}
                  onChange={(e) => setDialogSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {filteredDialogDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {dialogSearchTerm
                      ? "No devices match your search"
                      : "All devices are already in this group"}
                  </p>
                ) : (
                  filteredDialogDevices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        assignDeviceToGroup(device.id, selectedGroup?.id);
                        setAssignDialogOpen(false);
                        setDialogSearchTerm("");
                      }}
                    >
                      <div>
                        <p className="font-medium">{device.deviceName}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {device.deviceId} • {device.location || "No location"}
                          </p>
                          {device.allGroups?.length > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              {device.allGroups.map((g) => (
                                <Badge key={g.id} variant="outline" className="text-[10px] px-1 py-0">
                                  {g.name}
                                </Badge>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Drag Overlay - Shows device being dragged */}
        <DragOverlay>
          {activeDevice ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-primary bg-background p-3 shadow-lg">
              <Monitor className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-sm">{activeDevice.deviceName}</p>
                <p className="text-xs text-muted-foreground">
                  {activeDevice.deviceId}
                </p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
