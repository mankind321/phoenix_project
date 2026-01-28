/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  TooltipProps,
} from "recharts";
import { ReactNode } from "react";

export default function LeaseExpirationChart({ data }: { data: any[] }) {
  // 🛡 SAFETY: Prevent Recharts from crashing
  const list = Array.isArray(data) ? data : [];

  // --------------------------------------------
  // Date formatting (string only)
  // --------------------------------------------
  const formatDateString = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

  // --------------------------------------------
  // ✅ labelFormatter — ReactNode safe
  // --------------------------------------------
  const labelFormatter: TooltipProps<number, string>["labelFormatter"] = (
    label: ReactNode
  ) => {
    if (typeof label === "string") {
      return formatDateString(label);
    }
    return label;
  };

  // --------------------------------------------
  // ✅ formatter — number | undefined safe
  // --------------------------------------------
  const valueFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name
  ) => {
    if (typeof value !== "number") return "";

    return [`${value}`, name];
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">
        Lease Expiration Trend
      </h2>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={list}>
            <defs>
              <linearGradient id="leaseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#ec4899" stopOpacity={0.2} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="5 5" stroke="#e5e7eb" />

            <XAxis
              dataKey="month"
              tickFormatter={(v) =>
                typeof v === "string" ? formatDateString(v) : v
              }
              tick={{ fontSize: 12, fill: "#6b7280" }}
            />

            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              allowDecimals={false}
            />

            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                fontSize: "13px",
              }}
              formatter={valueFormatter}
              labelFormatter={labelFormatter}
            />

            <Line
              type="monotone"
              dataKey="expiring_count"
              name="Expiring Leases"
              stroke="url(#leaseGradient)"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "#ec4899" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
