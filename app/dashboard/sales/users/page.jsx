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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [createNewGroup, setCreateNewGroup] = useState(false);

  // Redirect non-admins
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";
  if (isLoaded && !isAdmin) {
    redirect("/dashboard/sales");
  }

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

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

  async function fetchGroups() {
    try {
      const res = await fetch("/api/admin/groups");
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  }

  async function handleUpdateRole() {
    if (!editingUser || !newRole) return;

    try {
      const updateData = { role: newRole };

      // Include group assignment for franchisees
      if (newRole === "franchisee") {
        if (createNewGroup) {
          updateData.createNewGroup = true;
        } else if (newGroupId) {
          updateData.groupId = newGroupId;
        }
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("User updated successfully");
        setEditingUser(null);
        setNewGroupId("");
        setCreateNewGroup(false);
        fetchUsers();
        fetchGroups(); // Refresh groups in case a new one was created
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

  const ownerCount = users.filter((u) => u.role === "owner").length;
  const franchiseeCount = users.filter((u) => u.role === "franchisee").length;
  const opsmanagerCount = users.filter((u) => u.role === "opsmanager").length;
  const driverCount = users.filter((u) => u.role === "driver").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-semibold">User Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage users and their roles
            </p>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-amber-100 p-3">
                <Crown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owners</p>
                <p className="text-2xl font-bold">{ownerCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
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
          <Card>
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
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-orange-100 p-3">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Drivers</p>
                <p className="text-2xl font-bold">{driverCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No users found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Franchisee</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
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
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "owner" || user.role === "ADMIN" ? "default" : "secondary"
                          }
                          className={`gap-1 ${
                            user.role === "opsmanager" || user.role === "MANAGER" ? "bg-purple-100 text-purple-800" :
                            user.role === "driver" || user.role === "DRIVER" ? "bg-orange-100 text-orange-800" : ""
                          }`}
                        >
                          {(user.role === "owner" || user.role === "ADMIN") && <Crown className="h-3 w-3" />}
                          {(user.role === "franchisee" || user.role === "FRANCHISEE") && <User className="h-3 w-3" />}
                          {(user.role === "opsmanager" || user.role === "MANAGER") && <Briefcase className="h-3 w-3" />}
                          {(user.role === "driver" || user.role === "DRIVER") && <Truck className="h-3 w-3" />}
                          {user.role?.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.group?.name ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {user.group.name}
                          </Badge>
                        ) : (user.role === "franchisee" || user.role === "FRANCHISEE") ? (
                          <span className="text-amber-600 text-sm">Not assigned</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
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
                                setNewRole(user.role?.toLowerCase() || "franchisee");
                                setNewGroupId(user.groupId || "");
                                setCreateNewGroup(false);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
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
          </CardContent>
        </Card>
      </main>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update settings for {editingUser?.firstName} {editingUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(value) => {
                setNewRole(value);
                if (value !== "franchisee") {
                  setNewGroupId("");
                  setCreateNewGroup(false);
                }
              }}>
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

            {/* Franchisee Group Assignment */}
            {newRole === "franchisee" && (
              <div className="grid gap-2">
                <Label>Assign to Franchisee</Label>
                <Select
                  value={createNewGroup ? "new" : newGroupId}
                  onValueChange={(value) => {
                    if (value === "new") {
                      setCreateNewGroup(true);
                      setNewGroupId("");
                    } else {
                      setCreateNewGroup(false);
                      setNewGroupId(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or create franchisee..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      <span className="text-blue-600">+ Create new franchisee</span>
                    </SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createNewGroup && (
                  <p className="text-xs text-muted-foreground">
                    A new franchisee will be created using the user&apos;s name
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
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
    </div>
  );
}
