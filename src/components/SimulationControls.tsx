import type { RoutingAlgorithm } from "../types/routingAlgorithm";
import { ROUTING_ALGORITHMS } from "../types/routingAlgorithm";

export interface SimulationControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  vehicleCount: number;
  onVehicleCountChange: (count: number) => void;
  transmissionRangePx: number;
  onTransmissionRangePxChange: (px: number) => void;
  routingAlgorithm: RoutingAlgorithm;
  onRoutingAlgorithmChange: (algorithm: RoutingAlgorithm) => void;
}

export function SimulationControls({
  isPlaying,
  onPlayPause,
  onReset,
  vehicleCount,
  onVehicleCountChange,
  transmissionRangePx,
  onTransmissionRangePxChange,
  routingAlgorithm,
  onRoutingAlgorithmChange,
}: SimulationControlsProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Simulation controls
      </h2>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPlayPause}
          className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-500"
              : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600"
        >
          Reset
        </button>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-slate-400">Number of vehicles</span>
        <input
          type="range"
          min={10}
          max={100}
          value={vehicleCount}
          onChange={(e) => onVehicleCountChange(Number(e.target.value))}
          className="accent-cyan-500"
        />
        <span className="font-mono text-xs text-cyan-400/90">{vehicleCount}</span>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-slate-400">Transmission range (meters)</span>
        <input
          type="range"
          min={40}
          max={300}
          value={transmissionRangePx}
          onChange={(e) =>
            onTransmissionRangePxChange(Number(e.target.value))
          }
          className="accent-cyan-500"
        />
        <span className="font-mono text-xs text-cyan-400/90">
          {transmissionRangePx}m
        </span>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-slate-400">Routing algorithm</span>
        <select
          value={routingAlgorithm}
          onChange={(e) =>
            onRoutingAlgorithmChange(e.target.value as RoutingAlgorithm)
          }
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/40 focus:ring-2"
        >
          {ROUTING_ALGORITHMS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
