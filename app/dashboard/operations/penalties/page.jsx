"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Ban,
  RefreshCw,
  Filter,
  X,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

const ITEMS_PER_PAGE = 20;

// Helper to format date/time
function formatDateTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Appeal status badge
function AppealStatusBadge({ status }) {
  const variants = {
    none: { className: "bg-gray-100 text-gray-800", label: "No Appeal" },
    pending: { className: "bg-yellow-100 text-yellow-800", label: "Pending" },
    approved: { className: "bg-green-100 text-green-800", label: "Approved" },
    rejected: { className: "bg-red-100 text-red-800", label: "Rejected" },
  };
  const config = variants[status] || variants.none;
  return <Badge className={config.className}>{config.label}</Badge>;
}

export default function PenaltiesPage() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "franchisee";
  const isAdmin = role === "owner" || role === "admin";
  const isOpsManager = role === "ops_manager";
  const canApproveReject = isAdmin; // Only admins can approve/reject appeals

  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Filters
  const [appealFilter, setAppealFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Appeal dialog
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState(null);
  const [appealNotes, setAppealNotes] = useState("");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [appealAction, setAppealAction] = useState("");
  const [dialogMode, setDialogMode] = useState("submit"); // "submit" or "review"

  useEffect(() => {
    fetchPenalties();
  }, [appealFilter]);

  async function fetchPenalties() {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();

      if (appealFilter !== "all") {
        params.set("appealStatus", appealFilter);
      }

      const res = await fetch(`/api/penalties?${params.toString()}`);
      const data = await res.json();

      if (data.penalties) {
        setPenalties(data.penalties);
      }
    } catch (error) {
      console.error("Error fetching penalties:", error);
      toast.error("Failed to fetch penalties");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchPenalties();
  }

  function openAppealDialog(penalty, mode) {
    setSelectedPenalty(penalty);
    setAppealNotes(penalty.appealNotes || "");
    setAdminRemarks("");
    setAppealAction("");
    setDialogMode(mode); // "submit" for submitting appeal, "review" for admin review
    setAppealDialogOpen(true);
  }

  async function handleAppeal(action = appealAction) {
    if (!selectedPenalty) return;

    const currentAction = action || appealAction;
    setActionLoading(selectedPenalty.id);
    try {
      const res = await fetch(`/api/penalties/${selectedPenalty.id}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentAction,
          appealNotes: dialogMode === "submit" ? appealNotes : adminRemarks,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Appeal ${currentAction === "submit" ? "submitted" : currentAction + "d"}`);
        setAppealDialogOpen(false);
        fetchPenalties();
      } else {
        toast.error(data.error || "Failed to process appeal");
      }
    } catch (error) {
      toast.error("Failed to process appeal");
    } finally {
      setActionLoading(null);
    }
  }

  // Count by appeal status
  const statusCounts = {
    total: penalties.length,
    none: penalties.filter((p) => p.appealStatus === "none").length,
    pending: penalties.filter((p) => p.appealStatus === "pending").length,
    approved: penalties.filter((p) => p.appealStatus === "approved").length,
    rejected: penalties.filter((p) => p.appealStatus === "rejected").length,
  };

  // Pagination
  const { totalItems, totalPages, getPageItems } = usePagination(penalties, ITEMS_PER_PAGE);
  const paginatedPenalties = getPageItems(currentPage);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Penalties</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              SLA breaches and appeal management
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 md:mr-2 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <Card className={`cursor-pointer ${appealFilter === "all" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setAppealFilter("all")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Ban className="h-4 w-4 text-gray-600" />
                <span className="text-xs">Total</span>
              </div>
              <p className="text-2xl font-bold">{statusCounts.total}</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${appealFilter === "none" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setAppealFilter("none")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-gray-600" />
                <span className="text-xs">No Appeal</span>
              </div>
              <p className="text-2xl font-bold">{statusCounts.none}</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${appealFilter === "pending" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setAppealFilter("pending")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-xs">Pending</span>
              </div>
              <p className="text-2xl font-bold">{statusCounts.pending}</p>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${appealFilter === "approved" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setAppealFilter("approved")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs">Approved</span>
              </div>
              <p className="text-2xl font-bold">{statusCounts.approved}</p>
            </CardContent>
          </Card>
        </div>

        {/* Penalties Table - Desktop */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Incident Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Appeal Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {penalties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No penalties found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPenalties.map((penalty) => (
                    <TableRow key={penalty.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{penalty.incident?.deviceName || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {penalty.incident?.deviceId || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {penalty.drivers && penalty.drivers.length > 0 ? (
                            penalty.drivers.map((driver, idx) => (
                              <div key={driver.id || idx} className="text-muted-foreground">
                                {driver.firstName && driver.lastName
                                  ? `${driver.firstName} ${driver.lastName}`
                                  : driver.username || "-"}
                              </div>
                            ))
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {penalty.incident?.type?.replace(/_/g, " ") || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {penalty.reason}
                      </TableCell>
                      <TableCell>
                        <AppealStatusBadge status={penalty.appealStatus} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(penalty.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {penalty.appealStatus === "none" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAppealDialog(penalty, "submit")}
                              disabled={actionLoading === penalty.id}
                            >
                              Appeal
                            </Button>
                          )}
                          {canApproveReject && penalty.appealStatus === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAppealDialog(penalty, "review")}
                              disabled={actionLoading === penalty.id}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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

        {/* Penalties Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {penalties.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No penalties found
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedPenalties.map((penalty) => (
                <Card
                  key={penalty.id}
                  className={`border-l-4 ${
                    penalty.appealStatus === "approved"
                      ? "border-l-green-500"
                      : penalty.appealStatus === "rejected"
                      ? "border-l-red-500"
                      : penalty.appealStatus === "pending"
                      ? "border-l-yellow-500"
                      : "border-l-gray-400"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{penalty.incident?.deviceName || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {penalty.incident?.deviceId || "-"}
                        </div>
                      </div>
                      <AppealStatusBadge status={penalty.appealStatus} />
                    </div>
                    {penalty.drivers && penalty.drivers.length > 0 && (
                      <div className="text-xs text-muted-foreground mb-2">
                        Driver: {penalty.drivers.map((d) =>
                          d.firstName && d.lastName ? `${d.firstName} ${d.lastName}` : d.username
                        ).join(", ")}
                      </div>
                    )}
                    <div className="mb-2">
                      <Badge variant="outline" className="mb-2">
                        {penalty.incident?.type?.replace(/_/g, " ") || "-"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {penalty.reason}
                    </p>
                    <div className="text-xs text-muted-foreground mb-3">
                      {formatDateTime(penalty.createdAt)}
                    </div>
                    <div className="flex gap-2">
                      {penalty.appealStatus === "none" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openAppealDialog(penalty, "submit")}
                          disabled={actionLoading === penalty.id}
                        >
                          Appeal
                        </Button>
                      )}
                      {canApproveReject && penalty.appealStatus === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openAppealDialog(penalty, "review")}
                          disabled={actionLoading === penalty.id}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      )}
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

      {/* Appeal Dialog */}
      <Dialog open={appealDialogOpen} onOpenChange={setAppealDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "submit" ? "Submit Appeal" : "Review Appeal"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Device Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Device</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPenalty?.incident?.deviceName || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Device ID</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPenalty?.incident?.deviceId || "-"}
                </p>
              </div>
            </div>

            {/* Incident Type */}
            <div>
              <p className="text-sm font-medium mb-1">Incident Type</p>
              <Badge variant="outline">
                {selectedPenalty?.incident?.type?.replace(/_/g, " ") || "-"}
              </Badge>
            </div>

            {/* Penalty Reason */}
            <div>
              <p className="text-sm font-medium mb-1">Penalty Reason</p>
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                {selectedPenalty?.reason}
              </p>
            </div>

            {/* Driver Info */}
            {selectedPenalty?.drivers && selectedPenalty.drivers.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Driver(s)</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPenalty.drivers.map((d) =>
                    d.firstName && d.lastName ? `${d.firstName} ${d.lastName}` : d.username
                  ).join(", ")}
                </p>
              </div>
            )}

            {/* Date */}
            <div>
              <p className="text-sm font-medium mb-1">Date</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(selectedPenalty?.createdAt)}
              </p>
            </div>

            {/* Submit Mode: Appeal Reason Input */}
            {dialogMode === "submit" && (
              <div>
                <label className="text-sm font-medium">Appeal Reason</label>
                <Textarea
                  className="mt-1"
                  placeholder="Explain why this penalty should be appealed..."
                  value={appealNotes}
                  onChange={(e) => setAppealNotes(e.target.value)}
                />
              </div>
            )}

            {/* Review Mode: Show Appeal Notes (read-only) and Remarks Input */}
            {dialogMode === "review" && (
              <>
                <div>
                  <p className="text-sm font-medium mb-1">Appeal Notes</p>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {selectedPenalty?.appealNotes || "No notes provided"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Admin Remarks</label>
                  <Textarea
                    className="mt-1"
                    placeholder="Add remarks for this decision (optional)..."
                    value={adminRemarks}
                    onChange={(e) => setAdminRemarks(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAppealDialogOpen(false)}>
              Cancel
            </Button>
            {dialogMode === "submit" && (
              <Button
                onClick={() => handleAppeal("submit")}
                disabled={actionLoading || !appealNotes}
              >
                {actionLoading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                Submit Appeal
              </Button>
            )}
            {dialogMode === "review" && (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleAppeal("reject")}
                  disabled={actionLoading}
                >
                  {actionLoading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleAppeal("approve")}
                  disabled={actionLoading}
                >
                  {actionLoading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
