import { useState } from "react";
import { RealtimeMetricsPanel } from "./RealtimeMetricsPanel";
import { SimulationCanvas } from "./SimulationCanvas";

export function V2VRoutingSimulatorLayout() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [resetGeneration, setResetGeneration] = useState(0);
  const [telemetry, setTelemetry] = useState({
    pdr: 96,
    latency: 32,
    throughput: 880,
  });

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
            onTelemetryUpdate={setTelemetry}
            className="min-h-[280px] flex-1"
          />
        </main>

        <aside className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:col-span-4 lg:min-h-0">
          <RealtimeMetricsPanel isPlaying={isPlaying} telemetry={telemetry} />
        </aside>
      </div>
    </div>
  );
}
