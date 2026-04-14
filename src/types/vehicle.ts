export type VehicleStatus = "active" | "inactive";

export interface Vehicle {
  id: number;
  lat: number;
  lng: number;
  speedMps: number;
  currentNodeIndex: number;
  routeNodeIndices: number[];
  path: [number, number][];
  targetWaypointIndex: number;
  status: VehicleStatus;
}
