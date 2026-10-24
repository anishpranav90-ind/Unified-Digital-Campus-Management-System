"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULT_COLORS = ["#2563eb", "#14b8a6", "#f97316", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#64748b"];

export function DonutChart({
  data,
  height = 220,
  colors = DEFAULT_COLORS,
}: {
  data: { name: string; value: number }[];
  height?: number;
  colors?: string[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted">No data to chart yet.</div>
    );
  }
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((item, index) => (
              <Cell key={item.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 8px 24px -16px rgba(15,23,42,.3)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-ink">{total}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted">total</span>
      </div>
    </div>
  );
}

export function ColumnChart({
  data,
  height = 240,
  color = "#2563eb",
  xKey = "label",
  dataKey = "jobs",
}: {
  data: Record<string, string | number>[];
  height?: number;
  color?: string;
  xKey?: string;
  dataKey?: string;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 8px 24px -16px rgba(15,23,42,.3)",
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ data, colors = DEFAULT_COLORS }: { data: { name: string; value: number }[]; colors?: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
      {data.map((item, index) => (
        <li key={item.name} className="flex items-center gap-2 text-[11px] text-slate-600">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: colors[index % colors.length] }}
          />
          <span className="min-w-0 flex-1 capitalize">{item.name.replace(/_/g, " ")}</span>
          <span className="font-semibold text-ink">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
