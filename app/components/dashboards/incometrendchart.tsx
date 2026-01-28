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

export default function IncomeTrendChart({ data }: { data: any[] }) {
  const list = Array.isArray(data) ? data : [];

  // --------------------------------------------
  // Date formatting
  // --------------------------------------------
  const formatDateString = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

  // --------------------------------------------
  // ✅ labelFormatter (NameType = string)
  // --------------------------------------------
  const labelFormatter: TooltipProps<number, string>["labelFormatter"] = (
    label
  ) => {
    if (typeof label === "string") {
      return formatDateString(label);
    }
    return label;
  };

  // --------------------------------------------
  // ✅ formatter (NameType = string)
  // --------------------------------------------
  const valueFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name
  ) => {
    if (typeof value !== "number") return "";

    return [`$${value.toLocaleString()}`, name];
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <h2 className="text-md font-semibold mb-4">
        Monthly Income Trend
      </h2>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={list}>
            <CartesianGrid strokeDasharray="5 5" stroke="#e5e7eb" />

            <XAxis
              dataKey="month"
              tickFormatter={(v) =>
                typeof v === "string" ? formatDateString(v) : v
              }
            />

            <YAxis
              tickFormatter={(v: number) =>
                `$${v.toLocaleString()}`
              }
            />

            <Tooltip
              formatter={valueFormatter}
              labelFormatter={labelFormatter}
            />

            <Line
              type="monotone"
              dataKey="monthly_income"
              name="Income"
              stroke="#3b82f6"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
