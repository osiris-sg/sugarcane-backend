"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Sortable table header component
 *
 * @param {Object} props
 * @param {string} props.column - The column key for sorting
 * @param {string} props.label - Display label for the column
 * @param {string} props.sortKey - Current sort key
 * @param {'asc' | 'desc'} props.sortDirection - Current sort direction
 * @param {function} props.onSort - Callback when sort is triggered (column) => void
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Alternative to label
 */
export function SortableTableHead({
  column,
  label,
  sortKey,
  sortDirection,
  onSort,
  className,
  children,
}) {
  const isActive = sortKey === column;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        <span>{children || label}</span>
        <span className="text-muted-foreground">
          {isActive ? (
            sortDirection === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          )}
        </span>
      </div>
    </TableHead>
  );
}

/**
 * Hook for managing table sorting state
 *
 * @param {string} defaultKey - Default sort column
 * @param {'asc' | 'desc'} defaultDirection - Default sort direction
 */
export function useTableSort(defaultKey = "", defaultDirection = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDirection, setSortDirection] = useState(defaultDirection);

  const handleSort = (column) => {
    if (sortKey === column) {
      // Toggle direction if same column
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // New column, default to ascending
      setSortKey(column);
      setSortDirection("asc");
    }
  };

  const sortData = (data, options = {}) => {
    if (!sortKey) return data;

    const { getNestedValue } = options;

    return [...data].sort((a, b) => {
      let aVal = getNestedValue ? getNestedValue(a, sortKey) : a[sortKey];
      let bVal = getNestedValue ? getNestedValue(b, sortKey) : b[sortKey];

      // Handle null/undefined
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      // Handle dates
      if (aVal instanceof Date) aVal = aVal.getTime();
      if (bVal instanceof Date) bVal = bVal.getTime();

      // Handle date strings
      if (typeof aVal === "string" && !isNaN(Date.parse(aVal)) && aVal.includes("-")) {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // Handle numbers stored as strings
      if (typeof aVal === "string" && !isNaN(aVal) && aVal !== "") {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }

      // Compare
      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  return {
    sortKey,
    sortDirection,
    handleSort,
    sortData,
  };
}
