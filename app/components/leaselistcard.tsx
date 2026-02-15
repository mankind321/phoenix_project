/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Loader2,
  Search as SearchIcon,
} from "lucide-react";

type Lease = {
  lease_id?: string;
  unique_id?: string;
  tenant?: string;
  landlord?: string;
  property_id?: string;
  property_name?: string;
  property_address?: string;
  property_type?: string;
  property_landlord?: string;
  lease_start?: string;
  lease_end?: string;
  annual_rent?: number | string;
  rent_psf?: number | string;
  price?: number | string;
  status?: string;
  comments?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
};

export default function LeaseListPage() {
  const router = useRouter();

  const [leases, setLeases] = useState<Lease[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Loading & pagination
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalPages, setTotalPages] = useState(1);

  // 🔒 SEARCH FIX
  const [searchInput, setSearchInput] = useState(""); // typing only
  const [search, setSearch] = useState(""); // applied filter only

  // Other filters (kept for compatibility)
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  /* ======================================================
     FETCH LEASES (ONLY reacts to applied search)
  ====================================================== */
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);

      const res = await fetch(`/api/lease?${params.toString()}`);
      const data = await res.json();

      if (data?.data) {
        setLeases(data.data);
        setTotalPages(
          Math.max(1, Math.ceil((data.total ?? 0) / pageSize)),
        );
      } else {
        setLeases([]);
        setTotalPages(1);
      }

      setIsLoading(false);
    }

    fetchData();
  }, [
    page,
    pageSize,
    search,
    status,
    fromDate,
    toDate,
    minPrice,
    maxPrice,
  ]);

  /* ======================================================
     RESET PAGE WHEN APPLIED FILTERS CHANGE
  ====================================================== */
  useEffect(() => {
    setPage(1);
  }, [search, status, fromDate, toDate, minPrice, maxPrice]);

  /* ======================================================
     APPLY SEARCH (MANUAL)
  ====================================================== */
  const applySearch = () => {
    setSearch(searchInput.trim());
  };

  return (
    <div className="w-11/12 mx-auto mt-6 space-y-6">
      {/* ======================== */}
      {/* FILTER SECTION */}
      {/* ======================== */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <FileText className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-800">
            Tenant Directory
          </h2>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Search tenant, property, landlord, or comments.
        </p>

        <div className="flex gap-2 items-center">
          <Input
            className="w-full h-10"
            placeholder="Search tenant, property, landlord…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
          />

          <Button
            onClick={applySearch}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 mt-2"
          >
            <SearchIcon className="w-4 h-4" />
            Search
          </Button>
        </div>
      </div>

      {/* ==================== */}
      {/* LEASE LIST */}
      {/* ==================== */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Tenant Information</h2>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-8 text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading Tenant Information…
          </div>
        )}

        {!isLoading && leases.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No Tenant Information found.
          </p>
        )}

        {!isLoading && leases.length > 0 && (
          <div className="space-y-4">
            {leases.map((lease) => {
              const key = `${lease.lease_id}-${lease.tenant}-${lease.lease_start}`;

              return (
                <div
                  key={key}
                  className="border border-gray-100 rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                        <FileText className="w-4 h-4" />
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-semibold text-gray-800">
                            {lease.tenant ?? "—"}
                        </h3>

                        <p className="text-xs text-gray-500">
                          {lease.property_name ??
                            lease.property_address}
                        </p>

                        <p className="text-xs text-gray-500">
                          Landlord:{" "}
                          <strong>{lease.landlord ?? "—"}</strong>
                        </p>

                        <p className="text-xs text-gray-400">
                          {lease.lease_start} → {lease.lease_end}
                        </p>
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-green-200">
                        {lease.status}
                      </span>

                      <div className="font-semibold text-gray-800">
                        $
                        {Number(
                          lease.annual_rent || lease.price || 0,
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() =>
                        setExpanded(expanded === key ? null : key)
                      }
                      className="text-sm text-blue-600 flex items-center gap-1"
                    >
                      {expanded === key ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          View Details
                        </>
                      )}
                    </button>

                    <Button
                      variant="outline"
                      className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                      onClick={() =>
                        router.push(`/dashboard/leases/${lease.lease_id}`)
                      }
                    >
                      <Eye />
                      View Tenant Details
                    </Button>
                  </div>

                  {expanded === key && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg border text-sm">
                      <p>
                        <strong>Property Type:</strong>{" "}
                        {lease.property_type}
                      </p>
                      <p>
                        <strong>Property Landlord:</strong>{" "}
                        {lease.property_landlord}
                      </p>
                      <p>
                        <strong>Comments:</strong>{" "}
                        {lease.comments ?? "—"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6 border-t pt-4">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>

              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
