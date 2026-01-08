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
} from "lucide-react";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;
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
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Redirect non-admins
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";
  if (isLoaded && !isAdmin) {
    redirect("/dashboard/operations");
  }

  useEffect(() => {
    fetchUsers();
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

  async function handleUpdateRole() {
    if (!editingUser || !newRole) return;

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("User role updated");
        setEditingUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
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

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(users, ITEMS_PER_PAGE);
  const paginatedUsers = getPageItems(currentPage);

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
        {/* Stats */}
        <div className="mb-4 md:mb-6 grid grid-cols-3 gap-2 md:gap-4 md:grid-cols-5">
          <Card>
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
          <Card>
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
          <Card>
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
          <Card className="hidden md:block">
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
          <Card className="hidden md:block">
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
              All Users
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
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
                    <TableHead>PIN</TableHead>
                    <TableHead>Created</TableHead>
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
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "owner" ? "default" : "secondary"
                          }
                          className={`gap-1 ${
                            user.role === "opsmanager" ? "bg-purple-100 text-purple-800" :
                            user.role === "driver" ? "bg-orange-100 text-orange-800" : ""
                          }`}
                        >
                          {user.role === "owner" && <Crown className="h-3 w-3" />}
                          {user.role === "franchisee" && <User className="h-3 w-3" />}
                          {user.role === "opsmanager" && <Briefcase className="h-3 w-3" />}
                          {user.role === "driver" && <Truck className="h-3 w-3" />}
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.role === "DRIVER" && user.loginPin ? (
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
                                setNewRole(user.role);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Role
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
            All Users
          </h2>
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading users...
              </CardContent>
            </Card>
          ) : users.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No users found
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
                          variant={user.role === "owner" ? "default" : "secondary"}
                          className={`gap-1 text-xs ${
                            user.role === "opsmanager" ? "bg-purple-100 text-purple-800" :
                            user.role === "driver" ? "bg-orange-100 text-orange-800" : ""
                          }`}
                        >
                          {user.role === "owner" && <Crown className="h-3 w-3" />}
                          {user.role === "franchisee" && <User className="h-3 w-3" />}
                          {user.role === "opsmanager" && <Briefcase className="h-3 w-3" />}
                          {user.role === "driver" && <Truck className="h-3 w-3" />}
                          {user.role}
                        </Badge>
                        {user.role === "DRIVER" && user.loginPin && (
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
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingUser?.firstName} {editingUser?.lastName}
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
