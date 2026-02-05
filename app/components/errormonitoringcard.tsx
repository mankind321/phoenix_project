/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ArrowUpDown,
  Trash2,
  FileWarning,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------ TYPE ---------------------- */
export interface ErrorMonitoringRecord {
  file_id: string;
  file_name: string;
  extraction_status: string;
  extraction_confidence_level_percentage: string;
  remarks: string | null;
  created_at: string; // ✅ NEW
}

/* ------------------ DELETE MODAL ---------------------- */
function DeleteErrorMonitoringModal({
  open,
  onClose,
  record,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  record: ErrorMonitoringRecord | null;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!record) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/errormonitoring/${record.file_id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Delete failed");
      }

      toast.success(`"${record.file_name}" deleted successfully.`);
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Record</DialogTitle>
          <DialogDescription>
            Delete <b>{record.file_name}</b>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------ DATE FORMATTER ---------------------- */
/* ------------------ DATE + TIME FORMATTER ---------------------- */
function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/* ------------------ MAIN COMPONENT ---------------------- */
export default function ErrorMonitoringTable() {
  const [data, setData] = React.useState<ErrorMonitoringRecord[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [loading, setLoading] = React.useState(true);

  // Pagination
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = React.useState(1);

  // Search
  const [search, setSearch] = React.useState("");

  // Delete modal
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ErrorMonitoringRecord | null>(
    null,
  );

  /* ------------------ FETCH ---------------------- */
  const loadRecords = React.useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/errormonitoring?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(
          search,
        )}`,
      );

      if (!res.ok) throw new Error("Failed to load records");

      const json = await res.json();
      setData(json.data || []);
      setTotalPages(Math.max(1, Math.ceil((json.total || 0) / pageSize)));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  React.useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  /* ------------------ COLUMNS ---------------------- */
  const columns = React.useMemo<ColumnDef<ErrorMonitoringRecord>[]>(
    () => [
      {
        id: "icon",
        header: "",
        enableSorting: false,
        cell: () => (
          <div className="flex justify-center">
            <FileWarning className="w-5 h-5 text-gray-500" />
          </div>
        ),
      },
      {
        accessorKey: "file_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            File Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-700 whitespace-nowrap">
            {formatDateTime(getValue<string>())}
          </span>
        ),
      },

      {
        accessorKey: "extraction_status",
        header: "Extraction Status",
      },
      {
        accessorKey: "extraction_confidence_level_percentage",
        header: "Extraction Level %",
        cell: ({ getValue }) => (
          <span className="font-medium text-red-600">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ row }) =>
          row.original.remarks ? (
            <div className="max-w-[520px] whitespace-normal break-words leading-relaxed text-sm text-gray-700">
              {row.original.remarks}
            </div>
          ) : (
            <span className="italic text-gray-400">—</span>
          ),
      },
      {
        id: "action",
        header: () => <div className="text-right">Action</div>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setSelected(row.original);
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className=" mx-auto space-y-6">
      {/* HEADER + SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3">
        <Input
          placeholder="Search file name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full md:w-[320px]"
        />
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-white">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : data.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-t hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-3 align-top">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-6 text-center text-gray-500"
                >
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* PAGINATION */}
        <div className="flex items-center justify-between px-4 py-4 border-t bg-white rounded-b-lg">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <span className="text-sm text-gray-700">
            Page <b>{page}</b> of <b>{totalPages}</b>
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <DeleteErrorMonitoringModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        record={selected}
        onDeleted={loadRecords}
      />
    </div>
  );
}
