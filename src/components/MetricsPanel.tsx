import { memo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface Telemetry {
  pdr: number;
  latency: number;
  throughput: number;
}

export interface ChartDataPoint extends Telemetry {
  time: number;
}

interface MetricsPanelProps {
  telemetry: Telemetry;
  chartData: ChartDataPoint[];
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-100">{value}</span>
        <span className="text-[10px] text-slate-600">{unit}</span>
      </div>
    </div>
  );
}

function MetricsPanelBase({ telemetry, chartData }: MetricsPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Real-Time Metrics
      </h2>

      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <MetricCard
          label="Packet Delivery Ratio"
          value={`${telemetry.pdr.toFixed(1)}%`}
          unit="%"
        />
        <MetricCard label="Latency" value={`${telemetry.latency.toFixed(0)}`} unit="ms" />
        <MetricCard
          label="Throughput"
          value={`${telemetry.throughput.toFixed(0)}`}
          unit="kbps"
        />
      </div>

      <div className="flex min-h-[220px] w-full min-w-0 flex-1 basis-0 flex-col">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.45)" />
            <XAxis
              dataKey="time"
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              label={{
                value: "Time (s)",
                position: "insideBottom",
                offset: -2,
                fill: "#64748b",
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="pdr"
              orientation="left"
              domain={[60, 100]}
              width={30}
              stroke="#22d3ee"
              tick={{ fill: "#67e8f9", fontSize: 10 }}
            />
            <YAxis
              yAxisId="lat"
              orientation="right"
              domain={[0, 220]}
              width={34}
              stroke="#fb923c"
              tick={{ fill: "#fdba74", fontSize: 10 }}
            />
            <YAxis
              yAxisId="tp"
              orientation="right"
              domain={[0, 1300]}
              width={36}
              offset={38}
              stroke="#a78bfa"
              tick={{ fill: "#c4b5fd", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(51, 65, 85, 0.9)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              formatter={(value) =>
                value === "pdr"
                  ? "PDR (%)"
                  : value === "latency"
                    ? "Latency (ms)"
                    : "Throughput (kbps)"
              }
            />
            <Line
              yAxisId="pdr"
              type="monotone"
              dataKey="pdr"
              name="pdr"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="lat"
              type="monotone"
              dataKey="latency"
              name="latency"
              stroke="#fb923c"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="tp"
              type="monotone"
              dataKey="throughput"
              name="throughput"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const MetricsPanel = memo(MetricsPanelBase);
