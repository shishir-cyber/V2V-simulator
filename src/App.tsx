import { useCallback, useEffect, useRef, useState } from "react";
import { MetricsPanel, type ChartDataPoint, type Telemetry } from "./components/MetricsPanel";
import { SimulationCanvas } from "./components/SimulationCanvas";

const MAX_POINTS = 40;

export default function App() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [resetGeneration, setResetGeneration] = useState(0);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    pdr: 96,
    latency: 32,
    throughput: 880,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const latestTelemetryRef = useRef<Telemetry>(telemetry);
  const elapsedSecondsRef = useRef(0);

  const handleTelemetryUpdate = useCallback((next: Telemetry) => {
    latestTelemetryRef.current = next;
    setTelemetry(next);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const intervalId = window.setInterval(() => {
      elapsedSecondsRef.current += 1;
      const point: ChartDataPoint = {
        time: elapsedSecondsRef.current,
        ...latestTelemetryRef.current,
      };
      setChartData((prev) => [...prev, point].slice(-MAX_POINTS));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isPlaying]);

  useEffect(() => {
    elapsedSecondsRef.current = 0;
    const resetTelemetry: Telemetry = { pdr: 96, latency: 32, throughput: 880 };
    latestTelemetryRef.current = resetTelemetry;
    setTelemetry(resetTelemetry);
    setChartData([]);
  }, [resetGeneration]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      <header className="shrink-0 border-b border-slate-800 px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">
          V2V Network Routing Simulator
        </h1>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => setResetGeneration((n) => n + 1)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3 p-3">
        <main className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-8">
          <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Live city map
          </h2>
          <SimulationCanvas
            isPlaying={isPlaying}
            resetGeneration={resetGeneration}
            onTelemetryUpdate={handleTelemetryUpdate}
            className="min-h-[280px] flex-1"
          />
        </main>
        <aside className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:col-span-4 lg:min-h-0">
          <MetricsPanel telemetry={telemetry} chartData={chartData} />
        </aside>
      </div>
    </div>
  );
}
