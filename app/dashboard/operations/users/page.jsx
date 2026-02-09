"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  Mail,
  Shield,
  Trash2,
  Edit,
  MoreHorizontal,
  Crown,
  User,
  Briefcase,
  Truck,
  KeyRound,
  Search,
  X,
  Check,
} from "lucide-react";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function UsersPage() {
  const { user, isLoaded } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState(null); // null = all, "owner", "franchisee", "opsmanager", "driver"
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [editingDriversUser, setEditingDriversUser] = useState(null); // Separate state for editing drivers only

  // Redirect non-admins
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";
  if (isLoaded && !isAdmin) {
    redirect("/dashboard/operations");
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // Load drivers when editing an ops manager (role edit)
  useEffect(() => {
    if (editingUser && ["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(newRole)) {
      fetchAvailableDrivers(editingUser);
      // Pre-select the already assigned drivers
      setSelectedDriverIds(editingUser.assignedDrivers?.map((d) => d.id) || []);
    } else if (!editingDriversUser) {
      setAvailableDrivers([]);
      setSelectedDriverIds([]);
    }
  }, [editingUser, newRole]);

  // Load drivers when using the dedicated "Edit Assigned Drivers" dialog
  useEffect(() => {
    if (editingDriversUser) {
      fetchAvailableDrivers(editingDriversUser);
      setSelectedDriverIds(editingDriversUser.assignedDrivers?.map((d) => d.id) || []);
    }
  }, [editingDriversUser]);

  async function fetchAvailableDrivers(targetUser) {
    setLoadingDrivers(true);
    try {
      // Get all drivers - include those assigned to the current ops manager
      const drivers = users.filter(
        (u) =>
          ["driver", "DRIVER"].includes(u.role) &&
          (!u.opsManagerId || u.opsManager?.id === targetUser?.id)
      );
      setAvailableDrivers(drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoadingDrivers(false);
    }
  }

  function toggleDriver(driverId) {
    setSelectedDriverIds((prev) =>
      prev.includes(driverId)
        ? prev.filter((id) => id !== driverId)
        : [...prev, driverId]
    );
  }

  async function handleUpdateDrivers() {
    if (!editingDriversUser) return;

    try {
      const res = await fetch(`/api/admin/users/${editingDriversUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedDriverIds: selectedDriverIds }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Assigned drivers updated");
        setEditingDriversUser(null);
        setSelectedDriverIds([]);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to update drivers");
      }
    } catch (error) {
      console.error("Error updating drivers:", error);
      toast.error("Failed to update drivers");
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateRole() {
    if (!editingUser || !newRole) return;

    try {
      const updateData = { role: newRole };

      // Include assigned drivers for ops managers
      if (["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(newRole)) {
        updateData.assignedDriverIds = selectedDriverIds;
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("User updated");
        setEditingUser(null);
        setSelectedDriverIds([]);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;

    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        toast.success("User deleted");
        setDeleteUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const ownerCount = users.filter((u) => ["owner", "admin", "OWNER", "ADMIN"].includes(u.role)).length;
  const franchiseeCount = users.filter((u) => ["franchisee", "FRANCHISEE"].includes(u.role)).length;
  const opsmanagerCount = users.filter((u) => ["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(u.role)).length;
  const driverCount = users.filter((u) => ["driver", "DRIVER"].includes(u.role)).length;

  // Filter users based on search and role
  const filteredUsers = users.filter((u) => {
    // Search filter
    const searchLower = searchText.toLowerCase();
    const matchesSearch = !searchText ||
      (u.firstName?.toLowerCase().includes(searchLower)) ||
      (u.lastName?.toLowerCase().includes(searchLower)) ||
      (u.email?.toLowerCase().includes(searchLower)) ||
      (`${u.firstName} ${u.lastName}`.toLowerCase().includes(searchLower));

    // Role filter
    let matchesRole = true;
    if (roleFilter === "owner") {
      matchesRole = ["owner", "admin", "OWNER", "ADMIN"].includes(u.role);
    } else if (roleFilter === "franchisee") {
      matchesRole = ["franchisee", "FRANCHISEE"].includes(u.role);
    } else if (roleFilter === "opsmanager") {
      matchesRole = ["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(u.role);
    } else if (roleFilter === "driver") {
      matchesRole = ["driver", "DRIVER"].includes(u.role);
    }

    return matchesSearch && matchesRole;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, roleFilter]);

  // Pagination using filtered users
  const { totalItems, totalPages, getPageItems } = usePagination(filteredUsers, ITEMS_PER_PAGE);
  const paginatedUsers = getPageItems(currentPage);

  // Handle role card click
  const handleRoleCardClick = (role) => {
    setRoleFilter(roleFilter === role ? null : role);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchText("");
    setRoleFilter(null);
  };

  const hasFilters = searchText || roleFilter;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">User Management</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Manage users and their roles
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Search Bar */}
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-10"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Stats - Clickable Role Cards */}
        <div className="mb-4 md:mb-6 grid grid-cols-3 gap-2 md:gap-4 md:grid-cols-5">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${roleFilter === null ? "ring-2 ring-blue-500" : ""}`}
            onClick={() => setRoleFilter(null)}
          >
            <CardContent className="flex flex-col md:flex-row items-center gap-2 md:gap-4 p-3 md:p-4">
              <div className="rounded-full bg-blue-100 p-2 md:p-3">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm text-muted-foreground">Total</p>
                <p className="text-xl md:text-2xl font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${roleFilter === "owner" ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => handleRoleCardClick("owner")}
          >
            <CardContent className="flex flex-col md:flex-row items-center gap-2 md:gap-4 p-3 md:p-4">
              <div className="rounded-full bg-amber-100 p-2 md:p-3">
                <Crown className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm text-muted-foreground">Owners</p>
                <p className="text-xl md:text-2xl font-bold">{ownerCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${roleFilter === "driver" ? "ring-2 ring-orange-500" : ""}`}
            onClick={() => handleRoleCardClick("driver")}
          >
            <CardContent className="flex flex-col md:flex-row items-center gap-2 md:gap-4 p-3 md:p-4">
              <div className="rounded-full bg-orange-100 p-2 md:p-3">
                <Truck className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm text-muted-foreground">Drivers</p>
                <p className="text-xl md:text-2xl font-bold">{driverCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`hidden md:block cursor-pointer transition-all hover:shadow-md ${roleFilter === "franchisee" ? "ring-2 ring-green-500" : ""}`}
            onClick={() => handleRoleCardClick("franchisee")}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-green-100 p-3">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Franchisees</p>
                <p className="text-2xl font-bold">{franchiseeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`hidden md:block cursor-pointer transition-all hover:shadow-md ${roleFilter === "opsmanager" ? "ring-2 ring-purple-500" : ""}`}
            onClick={() => handleRoleCardClick("opsmanager")}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-purple-100 p-3">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ops Managers</p>
                <p className="text-2xl font-bold">{opsmanagerCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table - Desktop */}
        <Card className="hidden md:block">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Users className="h-4 w-4 md:h-5 md:w-5" />
              {hasFilters ? `Filtered Users (${filteredUsers.length})` : "All Users"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {hasFilters ? "No users match your filters" : "No users found"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned Drivers</TableHead>
                    <TableHead>PIN</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.imageUrl ? (
                            <img
                              src={user.imageUrl}
                              alt=""
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                          <span className="font-medium">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm text-muted-foreground">@{user.username}</code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ["owner", "admin", "OWNER", "ADMIN"].includes(user.role) ? "default" : "secondary"
                          }
                          className={`gap-1 ${
                            ["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) ? "bg-purple-100 text-purple-800" :
                            ["driver", "DRIVER"].includes(user.role) ? "bg-orange-100 text-orange-800" : ""
                          }`}
                        >
                          {["owner", "admin", "OWNER", "ADMIN"].includes(user.role) && <Crown className="h-3 w-3" />}
                          {["franchisee", "FRANCHISEE"].includes(user.role) && <User className="h-3 w-3" />}
                          {["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) && <Briefcase className="h-3 w-3" />}
                          {["driver", "DRIVER"].includes(user.role) && <Truck className="h-3 w-3" />}
                          {user.role === "OPS_MANAGER" ? "opsmanager" : user.role?.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) && user.assignedDrivers?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.assignedDrivers.map((driver) => (
                              <Badge key={driver.id} variant="outline" className="text-xs">
                                <Truck className="h-3 w-3 mr-1" />
                                {driver.firstName || driver.username}
                              </Badge>
                            ))}
                          </div>
                        ) : ["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) ? (
                          <span className="text-xs text-muted-foreground">No drivers</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {["driver", "DRIVER"].includes(user.role) && user.loginPin ? (
                          <div className="flex items-center gap-1.5">
                            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                            <code className="font-mono text-sm tracking-widest bg-muted px-2 py-0.5 rounded">
                              {user.loginPin}
                            </code>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.lastSignInAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingUser(user);
                                setNewRole(user.role);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Role
                            </DropdownMenuItem>
                            {["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) && (
                              <DropdownMenuItem
                                onClick={() => setEditingDriversUser(user)}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Edit Assigned Drivers
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteUser(user)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {totalPages > 1 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            )}
          </CardContent>
        </Card>

        {/* Users Cards - Mobile */}
        <div className="md:hidden space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            {hasFilters ? `Filtered Users (${filteredUsers.length})` : `All Users (${users.length})`}
          </h2>
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading users...
              </CardContent>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {hasFilters ? "No users match your filters" : "No users found"}
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt="" className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingUser(user);
                              setNewRole(user.role);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Role
                          </DropdownMenuItem>
                          {["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) && (
                            <DropdownMenuItem
                              onClick={() => setEditingDriversUser(user)}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Edit Assigned Drivers
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteUser(user)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={["owner", "admin", "OWNER", "ADMIN"].includes(user.role) ? "default" : "secondary"}
                          className={`gap-1 text-xs ${
                            ["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) ? "bg-purple-100 text-purple-800" :
                            ["driver", "DRIVER"].includes(user.role) ? "bg-orange-100 text-orange-800" : ""
                          }`}
                        >
                          {["owner", "admin", "OWNER", "ADMIN"].includes(user.role) && <Crown className="h-3 w-3" />}
                          {["franchisee", "FRANCHISEE"].includes(user.role) && <User className="h-3 w-3" />}
                          {["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(user.role) && <Briefcase className="h-3 w-3" />}
                          {["driver", "DRIVER"].includes(user.role) && <Truck className="h-3 w-3" />}
                          {user.role === "OPS_MANAGER" ? "opsmanager" : user.role?.toLowerCase()}
                        </Badge>
                        {["driver", "DRIVER"].includes(user.role) && user.loginPin && (
                          <code className="font-mono text-xs tracking-widest bg-muted px-1.5 py-0.5 rounded">
                            {user.loginPin}
                          </code>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Last: {formatDate(user.lastSignInAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {totalPages > 1 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => {
        setEditingUser(null);
        setSelectedDriverIds([]);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update {editingUser?.firstName} {editingUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Owner
                    </div>
                  </SelectItem>
                  <SelectItem value="franchisee">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Franchisee
                    </div>
                  </SelectItem>
                  <SelectItem value="opsmanager">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Ops Manager
                    </div>
                  </SelectItem>
                  <SelectItem value="driver">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Driver
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Driver assignment for ops managers */}
            {["opsmanager", "manager", "OPSMANAGER", "MANAGER", "OPS_MANAGER"].includes(newRole) && (
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assign Drivers
                </Label>
                {loadingDrivers ? (
                  <p className="text-sm text-muted-foreground">Loading drivers...</p>
                ) : availableDrivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No drivers available to assign
                  </p>
                ) : (
                  <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-auto">
                    {availableDrivers.map((driver) => (
                      <div
                        key={driver.id}
                        onClick={() => toggleDriver(driver.id)}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                          selectedDriverIds.includes(driver.id)
                            ? "bg-primary/10 border border-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">
                            {driver.firstName} {driver.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            @{driver.username}
                          </span>
                        </div>
                        {selectedDriverIds.includes(driver.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {selectedDriverIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedDriverIds.length} driver(s) selected
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingUser(null);
              setSelectedDriverIds([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteUser?.firstName}{" "}
              {deleteUser?.lastName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assigned Drivers Dialog (for Ops Managers) */}
      <Dialog open={!!editingDriversUser} onOpenChange={() => {
        setEditingDriversUser(null);
        setSelectedDriverIds([]);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Assigned Drivers</DialogTitle>
            <DialogDescription>
              Manage drivers assigned to {editingDriversUser?.firstName} {editingDriversUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {loadingDrivers ? (
              <p className="text-sm text-muted-foreground">Loading drivers...</p>
            ) : availableDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drivers available to assign
              </p>
            ) : (
              <div className="rounded-md border p-3 space-y-2 max-h-64 overflow-auto">
                {availableDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => toggleDriver(driver.id)}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                      selectedDriverIds.includes(driver.id)
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">
                        {driver.firstName} {driver.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{driver.username}
                      </span>
                    </div>
                    {selectedDriverIds.includes(driver.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            )}
            {selectedDriverIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedDriverIds.length} driver(s) selected
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingDriversUser(null);
              setSelectedDriverIds([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDrivers}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
