import { useEffect, useRef, useState } from "react";
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

export type MetricsChartPoint = {
  t: number;
  pdr: number;
  latency: number;
  throughput: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
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
        <span className="text-lg font-semibold tabular-nums text-slate-100">
          {value}
        </span>
        <span className="text-[10px] text-slate-600">{unit}</span>
      </div>
    </div>
  );
}

export interface RealtimeMetricsPanelProps {
  isPlaying: boolean;
  telemetry: {
    pdr: number;
    latency: number;
    throughput: number;
  };
}

export function RealtimeMetricsPanel({ isPlaying, telemetry }: RealtimeMetricsPanelProps) {
  const [chartData, setChartData] = useState<MetricsChartPoint[]>([]);
  const [latest, setLatest] = useState<{
    pdr: string;
    latency: string;
    throughput: string;
  }>({
    pdr: "—",
    latency: "—",
    throughput: "—",
  });
  const tRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) return;
    tRef.current += 1;
    const t = tRef.current;
    const pdr = clamp(telemetry.pdr, 0, 100);
    const latency = clamp(telemetry.latency, 0, 250);
    const throughput = clamp(telemetry.throughput, 0, 1500);
    const point: MetricsChartPoint = { t, pdr, latency, throughput };
    setChartData((prev) => [...prev, point].slice(-20));
    setLatest({
      pdr: `${pdr.toFixed(1)}%`,
      latency: `${latency.toFixed(0)}`,
      throughput: `${throughput.toFixed(0)}`,
    });
  }, [isPlaying, telemetry]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Real-time metrics
      </h2>

      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <MetricCard
          label="Packet delivery ratio"
          value={latest.pdr}
          unit="PDR"
        />
        <MetricCard label="Latency" value={latest.latency} unit="ms" />
        <MetricCard
          label="Throughput"
          value={latest.throughput}
          unit="kbps"
        />
      </div>

      <div className="flex min-h-[220px] w-full min-w-0 flex-1 basis-0 flex-col">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.45)" />
            <XAxis
              dataKey="t"
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
              domain={[70, 100]}
              width={30}
              stroke="#22d3ee"
              tick={{ fill: "#67e8f9", fontSize: 10 }}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              yAxisId="lat"
              orientation="right"
              domain={[0, 170]}
              width={34}
              stroke="#fb923c"
              tick={{ fill: "#fdba74", fontSize: 10 }}
            />
            <YAxis
              yAxisId="tp"
              orientation="right"
              domain={[0, 1000]}
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
              formatter={(value: number, name: string) => {
                if (name === "pdr") return [`${value.toFixed(1)}%`, "PDR"];
                if (name === "latency") return [`${value.toFixed(0)} ms`, "Latency"];
                if (name === "throughput")
                  return [`${value.toFixed(0)} kbps`, "Throughput"];
                return [value, name];
              }}
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
