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
  const isAdmin = role === "owner" || role === "admin";

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
        setGroups(groupsData.groups);
        // Expand all groups by default
        const expanded = {};
        groupsData.groups.forEach((g) => (expanded[g.id] = true));
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

  const removeDeviceFromGroup = async (deviceId) => {
    await assignDeviceToGroup(deviceId, null);
  };

  const unassignedDevices = devices.filter((d) => !d.groupId);

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

  const filteredUnassignedDevices = unassignedDevices.filter((d) => {
    const search = searchTerm.toLowerCase();
    return (
      d.deviceId?.toLowerCase().includes(search) ||
      d.deviceName?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search)
    );
  });

  const filteredDialogDevices = unassignedDevices.filter((d) => {
    const search = dialogSearchTerm.toLowerCase();
    return (
      d.deviceId?.toLowerCase().includes(search) ||
      d.deviceName?.toLowerCase().includes(search) ||
      d.location?.toLowerCase().includes(search)
    );
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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
          <div>
            <h1 className="text-xl font-semibold">Device Grouping</h1>
            <p className="text-sm text-muted-foreground">
              {groups.length} groups, {unassignedDevices.length} unassigned devices
              {unassignedDevices.length > 0 && " - Drag devices to assign"}
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Group
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

        <main className="p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            {/* Groups List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Franchisee Groups
                {activeId && (
                  <Badge variant="outline" className="ml-2 animate-pulse">
                    Drop here to assign
                  </Badge>
                )}
              </h2>

              {groups.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Layers className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No groups created yet</p>
                    <p className="text-sm">Click "New Group" to create one</p>
                  </CardContent>
                </Card>
              ) : (
                groups.map((group) => (
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
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleGroup(group.id)}
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            {expandedGroups[group.id] ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <CardTitle className="text-base">{group.name}</CardTitle>
                            <Badge variant="secondary">{group.deviceCount} devices</Badge>
                          </button>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedGroup(group);
                                setAssignDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Device
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteGroup(group.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {expandedGroups[group.id] && (
                        <CardContent>
                          {group.devices?.length === 0 ? (
                            <p className={`text-sm text-muted-foreground py-4 text-center ${
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
                                  className="flex items-center justify-between rounded-lg border p-3 bg-muted/30"
                                >
                                  <div className="flex items-center gap-3">
                                    <Monitor className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium">{device.deviceName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        ID: {device.deviceId}
                                        {device.location && (
                                          <span className="ml-2">• {device.location}</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => removeDeviceFromGroup(device.id)}
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

          {/* Unassigned Devices */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Unassigned Devices
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
                  {filteredUnassignedDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      {unassignedDevices.length === 0
                        ? "All devices are assigned to groups"
                        : "No devices match your search"}
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[500px] overflow-y-auto">
                      {filteredUnassignedDevices.map((device) => (
                        <DraggableDevice key={device.id} device={device}>
                          <div
                            className={`flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors ${
                              activeId === device.id ? "border-primary bg-primary/10" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              <div>
                                <p className="font-medium text-sm">{device.deviceName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {device.deviceId} • {device.location || "No location"}
                                </p>
                              </div>
                            </div>
                            {groups.length > 0 && (
                              <select
                                className="text-sm border rounded px-2 py-1 bg-background"
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
                                <option value="">Assign to...</option>
                                {groups.map((g) => (
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
                {unassignedDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No unassigned devices available
                  </p>
                ) : filteredDialogDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No devices match your search
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
                        <p className="text-xs text-muted-foreground">
                          {device.deviceId} • {device.location || "No location"}
                        </p>
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
