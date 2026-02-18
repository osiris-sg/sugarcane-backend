"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { useUserRoles } from "@/hooks/useUserRoles";
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
  Truck,
  Plus,
  Monitor,
  ChevronDown,
  ChevronRight,
  GripVertical,
  X,
  Search,
  User,
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
} from "@/components/ui/dialog";

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

// Droppable driver component
function DroppableDriver({ driver, children, isOver }) {
  const { setNodeRef } = useDroppable({
    id: driver.id,
    data: { driver },
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

export default function DriverAssignmentPage() {
  const { isLoaded } = useUser();
  const { isAdmin, isLoaded: rolesLoaded } = useUserRoles();

  const [drivers, setDrivers] = useState([]);
  const [unassignedDevices, setUnassignedDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDrivers, setExpandedDrivers] = useState({});
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogSearchTerm, setDialogSearchTerm] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Redirect non-admins
  if (isLoaded && rolesLoaded && !isAdmin) {
    redirect("/dashboard/operations");
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/driver-assignment");
      const data = await res.json();

      if (data.success) {
        setDrivers(data.drivers || []);
        setUnassignedDevices(data.unassignedDevices || []);
        // Expand all drivers by default
        const expanded = {};
        data.drivers?.forEach((d) => (expanded[d.id] = true));
        setExpandedDrivers(expanded);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDriver = (driverId) => {
    setExpandedDrivers((prev) => ({
      ...prev,
      [driverId]: !prev[driverId],
    }));
  };

  const assignDeviceToDriver = async (deviceId, driverId) => {
    try {
      const res = await fetch("/api/admin/driver-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, driverId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Error assigning device:", error);
    }
  };

  const removeDeviceFromDriver = async (deviceId) => {
    await assignDeviceToDriver(deviceId, null);
  };

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

    const device = active.data.current?.device;
    const driverId = over.id;

    if (!device) return;

    // Check if dropped on a valid driver
    const targetDriver = drivers.find((d) => d.id === driverId);
    if (!targetDriver) return;

    await assignDeviceToDriver(device.deviceId, driverId);
  };

  const activeDevice = activeId
    ? [...unassignedDevices, ...drivers.flatMap((d) => d.devices || [])].find(
        (d) => d.id === activeId
      )
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
        <header className="sticky top-0 z-30 border-b bg-background">
          <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
            <div>
              <h1 className="text-lg md:text-xl font-semibold">Driver Assignment</h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                {drivers.length} drivers, {unassignedDevices.length} unassigned
                <span className="hidden sm:inline">{unassignedDevices.length > 0 && " - Drag devices to assign"}</span>
              </p>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_350px]">
            {/* Drivers List */}
            <div className="space-y-3 md:space-y-4 order-2 lg:order-1">
              <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 md:h-5 md:w-5" />
                Drivers
                {activeId && (
                  <Badge variant="outline" className="ml-2 animate-pulse text-xs">
                    Drop here to assign
                  </Badge>
                )}
              </h2>

              {drivers.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Truck className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No drivers found</p>
                    <p className="text-sm">
                      Add users with the "driver" role in User Management
                    </p>
                  </CardContent>
                </Card>
              ) : (
                drivers.map((driver) => (
                  <DroppableDriver
                    key={driver.id}
                    driver={driver}
                    isOver={overId === driver.id}
                  >
                    <Card
                      className={`transition-all duration-200 ${
                        overId === driver.id
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleDriver(driver.id)}
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            {expandedDrivers[driver.id] ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <div className="flex items-center gap-3">
                              {driver.imageUrl ? (
                                <img
                                  src={driver.imageUrl}
                                  alt=""
                                  className="h-8 w-8 rounded-full"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                                  <User className="h-4 w-4 text-orange-600" />
                                </div>
                              )}
                              <div className="text-left">
                                <CardTitle className="text-base">
                                  {driver.firstName} {driver.lastName}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground font-normal">
                                  {driver.email}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="ml-2">
                              {driver.devices?.length || 0} devices
                            </Badge>
                          </button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setAssignDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Device
                          </Button>
                        </div>
                      </CardHeader>
                      {expandedDrivers[driver.id] && (
                        <CardContent>
                          {driver.devices?.length === 0 ? (
                            <p
                              className={`text-sm text-muted-foreground py-4 text-center ${
                                overId === driver.id
                                  ? "text-primary font-medium"
                                  : ""
                              }`}
                            >
                              {overId === driver.id
                                ? "Drop device here!"
                                : "No devices assigned"}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {driver.devices?.map((device) => (
                                <div
                                  key={device.id}
                                  className="flex items-center justify-between rounded-lg border p-3 bg-muted/30"
                                >
                                  <div className="flex items-center gap-3">
                                    <Monitor className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium">
                                        {device.location || device.deviceName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ID: {device.deviceId}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      removeDeviceFromDriver(device.deviceId)
                                    }
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
                  </DroppableDriver>
                ))
              )}
            </div>

            {/* Unassigned Devices */}
            <div className="space-y-3 md:space-y-4 order-1 lg:order-2">
              <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                <Monitor className="h-4 w-4 md:h-5 md:w-5" />
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
                        ? "All devices are assigned to drivers"
                        : "No devices match your search"}
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[300px] md:max-h-[500px] overflow-y-auto">
                      {filteredUnassignedDevices.map((device) => (
                        <DraggableDevice key={device.id} device={device}>
                          <div
                            className={`flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors ${
                              activeId === device.id
                                ? "border-primary bg-primary/10"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              <div>
                                <p className="font-medium text-sm">
                                  {device.location || device.deviceName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  ID: {device.deviceId}
                                </p>
                              </div>
                            </div>
                            {drivers.length > 0 && (
                              <select
                                className="text-sm border rounded px-2 py-1 bg-background"
                                defaultValue=""
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignDeviceToDriver(
                                      device.deviceId,
                                      e.target.value
                                    );
                                    e.target.value = "";
                                  }
                                }}
                              >
                                <option value="">Assign to...</option>
                                {drivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.firstName} {d.lastName}
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
              <DialogTitle>
                Add Device to {selectedDriver?.firstName} {selectedDriver?.lastName}
              </DialogTitle>
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
                        assignDeviceToDriver(device.deviceId, selectedDriver?.id);
                        setAssignDialogOpen(false);
                        setDialogSearchTerm("");
                      }}
                    >
                      <div>
                        <p className="font-medium">{device.location || device.deviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {device.deviceId}
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

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDevice ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-primary bg-background p-3 shadow-lg">
              <Monitor className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-sm">{activeDevice.location || activeDevice.deviceName}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {activeDevice.deviceId}
                </p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
