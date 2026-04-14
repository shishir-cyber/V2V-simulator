import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, useMapEvents } from "react-leaflet";

const CENTER: [number, number] = [12.9716, 77.5946];
const ZONE_RADIUS_METERS = 40;
const EARLY_DETECTION_BUFFER = 80; // meters
const LOOKAHEAD_SEGMENTS = 5; // number of upcoming segments to inspect
const EARLY_DETECTION_RADIUS = ZONE_RADIUS_METERS + EARLY_DETECTION_BUFFER;
const INTERFERENCE_BLOCK_RADIUS_METERS = 100;
const VEHICLE_SPEED_MPS = 9;
const V2V_RADIUS = 150;

interface SimulationCanvasProps {
  isPlaying?: boolean;
  resetGeneration?: number;
  className?: string;
  onTelemetryUpdate?: (telemetry: {
    pdr: number;
    latency: number;
    throughput: number;
  }) => void;
}

type LatLngTuple = [number, number];

interface InterferenceZone {
  id: number;
  lat: number;
  lng: number;
}

interface RoadNode {
  lat: number;
  lng: number;
  neighbors: number[];
}

interface RoadGraph {
  nodes: RoadNode[];
  adjacencyByKey: Record<string, Array<{ node: string; distance: number }>>;
}

interface OverpassWay {
  type: "way";
  nodes?: number[];
}

interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

interface OverpassResponse {
  elements?: Array<OverpassWay | OverpassNode>;
}

interface SimVehicle {
  id: string;
  currentPosition: LatLngTuple;
  destinationNode: number;
  route: LatLngTuple[];
  progressIndex: number;
  knownInterferences: InterferenceZone[];
}

export function generateFallbackRoadGraph(center: [number, number]): RoadGraph {
  const [centerLat, centerLng] = center;
  const rows = 5;
  const cols = 5;
  const spacingLat = 0.0012;
  const spacingLng = 0.0012;

  const nodes: RoadNode[] = [];
  const adjacencyByKey: Record<string, Array<{ node: string; distance: number }>> = {};
  const edgeSeen = new Set<string>();

  const nodeIndex = (r: number, c: number) => r * cols + c;
  const keyFor = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

  const latOrigin = centerLat - ((rows - 1) / 2) * spacingLat;
  const lngOrigin = centerLng - ((cols - 1) / 2) * spacingLng;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = latOrigin + r * spacingLat;
      const lng = lngOrigin + c * spacingLng;
      nodes.push({ lat, lng, neighbors: [] });
    }
  }

  const addUndirectedEdge = (aIdx: number, bIdx: number) => {
    const a = nodes[aIdx]!;
    const b = nodes[bIdx]!;
    if (!a.neighbors.includes(bIdx)) a.neighbors.push(bIdx);
    if (!b.neighbors.includes(aIdx)) b.neighbors.push(aIdx);

    const aKey = keyFor(a.lat, a.lng);
    const bKey = keyFor(b.lat, b.lng);
    const distance = segmentDistanceMeters(a, b);

    const addDirected = (fromKey: string, toKey: string) => {
      const dedupeKey = `${fromKey}|${toKey}`;
      if (edgeSeen.has(dedupeKey)) return;
      edgeSeen.add(dedupeKey);
      if (!adjacencyByKey[fromKey]) adjacencyByKey[fromKey] = [];
      adjacencyByKey[fromKey]!.push({ node: toKey, distance });
    };
    addDirected(aKey, bKey);
    addDirected(bKey, aKey);
  };

  // Grid edges (horizontal + vertical)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = nodeIndex(r, c);
      if (c + 1 < cols) addUndirectedEdge(idx, nodeIndex(r, c + 1));
      if (r + 1 < rows) addUndirectedEdge(idx, nodeIndex(r + 1, c));
    }
  }

  // Add diagonals on every other cell for more routing variety.
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if ((r + c) % 2 === 0) {
        addUndirectedEdge(nodeIndex(r, c), nodeIndex(r + 1, c + 1));
      }
    }
  }

  return { nodes, adjacencyByKey };
}

function metersPerDegreeLng(lat: number): number {
  return Math.max(1, 111_320 * Math.cos((lat * Math.PI) / 180));
}

function toMeters(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - CENTER[1]) * metersPerDegreeLng(CENTER[0]),
    y: (lat - CENTER[0]) * 111_320,
  };
}

function segmentDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const ap = toMeters(a.lat, a.lng);
  const bp = toMeters(b.lat, b.lng);
  return Math.hypot(bp.x - ap.x, bp.y - ap.y);
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function pointToSegmentDistanceSq(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return ex * ex + ey * ey;
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  const ex = p.x - cx;
  const ey = p.y - cy;
  return ex * ex + ey * ey;
}

function intersectsZone(a: RoadNode, b: RoadNode, z: InterferenceZone): boolean {
  const p1 = toMeters(a.lat, a.lng);
  const p2 = toMeters(b.lat, b.lng);
  const c = toMeters(z.lat, z.lng);
  return pointToSegmentDistanceSq(c, p1, p2) <= ZONE_RADIUS_METERS * ZONE_RADIUS_METERS;
}

function segmentIntersectsZoneWithRadius(
  start: LatLngTuple,
  end: LatLngTuple,
  zone: InterferenceZone,
  radiusMeters: number,
): boolean {
  const p1 = toMeters(start[0], start[1]);
  const p2 = toMeters(end[0], end[1]);
  const c = toMeters(zone.lat, zone.lng);
  return pointToSegmentDistanceSq(c, p1, p2) <= radiusMeters * radiusMeters;
}

function findImminentInterference(
  vehicle: SimVehicle,
  zones: InterferenceZone[],
): InterferenceZone | null {
  if (vehicle.route.length < 2 || zones.length === 0) return null;
  const baseSegIdx = Math.floor(vehicle.progressIndex);
  for (const zone of zones) {
    for (let offset = 0; offset < LOOKAHEAD_SEGMENTS; offset++) {
      const segIdx = baseSegIdx + offset;
      if (segIdx >= vehicle.route.length - 1) break;
      const segStart =
        offset === 0 ? vehicle.currentPosition : vehicle.route[segIdx]!;
      const segEnd = vehicle.route[segIdx + 1]!;
      if (
        segmentIntersectsZoneWithRadius(
          segStart,
          segEnd,
          zone,
          EARLY_DETECTION_RADIUS,
        )
      ) {
        return zone;
      }
    }
  }
  return null;
}

function buildBlockedEdges(graph: RoadGraph, zones: InterferenceZone[]): Set<string> {
  const blocked = new Set<string>();
  for (let i = 0; i < graph.nodes.length; i++) {
    for (const j of graph.nodes[i]!.neighbors) {
      if (j <= i) continue;
      if (zones.some((z) => intersectsZone(graph.nodes[i]!, graph.nodes[j]!, z))) {
        blocked.add(edgeKey(i, j));
      }
    }
  }
  return blocked;
}

function runDijkstra(
  graph: RoadGraph,
  start: number,
  blockedEdges: Set<string>,
  activeInterferences: InterferenceZone[],
) {
  const n = graph.nodes.length;
  const dist = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(n).fill(-1);
  const seen = new Uint8Array(n);
  dist[start] = 0;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      if (!seen[i] && dist[i]! < best) {
        best = dist[i]!;
        u = i;
      }
    }
    if (u < 0 || !Number.isFinite(best)) break;
    seen[u] = 1;

    for (const v of graph.nodes[u]!.neighbors) {
      if (seen[v]) continue;
      if (blockedEdges.has(edgeKey(u, v))) continue;
      const blockedNode = activeInterferences.some(
        (zone) =>
          haversineMeters(
            { lat: graph.nodes[v]!.lat, lng: graph.nodes[v]!.lng },
            { lat: zone.lat, lng: zone.lng },
          ) <= INTERFERENCE_BLOCK_RADIUS_METERS,
      );
      if (blockedNode) continue;
      const w = segmentDistanceMeters(graph.nodes[u]!, graph.nodes[v]!);
      const alt = dist[u]! + w;
      if (alt < dist[v]!) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }
  return { dist, prev };
}

function reconstructPath(prev: number[], start: number, end: number): number[] | null {
  const out: number[] = [];
  let c = end;
  for (;;) {
    out.push(c);
    if (c === start) break;
    c = prev[c]!;
    if (c < 0) return null;
  }
  out.reverse();
  return out;
}

function dijkstraPath(
  graph: RoadGraph,
  start: number,
  dest: number,
  blocked: Set<string>,
  activeInterferences: InterferenceZone[],
): number[] | null {
  const destinationBlocked = activeInterferences.some(
    (zone) =>
      haversineMeters(
        { lat: graph.nodes[dest]!.lat, lng: graph.nodes[dest]!.lng },
        { lat: zone.lat, lng: zone.lng },
      ) <= INTERFERENCE_BLOCK_RADIUS_METERS,
  );
  if (destinationBlocked) return null;
  const { dist, prev } = runDijkstra(graph, start, blocked, activeInterferences);
  if (!Number.isFinite(dist[dest]!)) return null;
  return reconstructPath(prev, start, dest);
}

function coordsFromPath(graph: RoadGraph, path: number[]): LatLngTuple[] {
  return path.map((idx) => [graph.nodes[idx]!.lat, graph.nodes[idx]!.lng] as LatLngTuple);
}

function findNearestGraphNode(
  graph: RoadGraph,
  lat: number,
  lng: number,
): number {
  const keyToIndex = new Map<string, number>();
  graph.nodes.forEach((n, i) => keyToIndex.set(`${n.lat.toFixed(6)},${n.lng.toFixed(6)}`, i));

  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const key of Object.keys(graph.adjacencyByKey)) {
    const [latS, lngS] = key.split(",");
    const nodeLat = Number(latS);
    const nodeLng = Number(lngS);
    if (!Number.isFinite(nodeLat) || !Number.isFinite(nodeLng)) continue;
    const d = haversineMeters({ lat, lng }, { lat: nodeLat, lng: nodeLng });
    if (d < bestDist) {
      bestDist = d;
      bestIdx = keyToIndex.get(key) ?? bestIdx;
    }
  }
  return bestIdx;
}

function mergeInterferences(a: InterferenceZone[], b: InterferenceZone[]): InterferenceZone[] {
  const out = [...a];
  for (const zone of b) {
    if (!out.some((z) => z.id === zone.id)) out.push(zone);
  }
  return out;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  timeoutMs = 15000,
): Promise<Response> {
  const upstreamSignal = options.signal;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const onUpstreamAbort = () => controller.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      upstreamSignal.addEventListener("abort", onUpstreamAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (upstreamSignal) upstreamSignal.removeEventListener("abort", onUpstreamAbort);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (upstreamSignal) upstreamSignal.removeEventListener("abort", onUpstreamAbort);
      if (error instanceof DOMException && error.name === "AbortError") {
        if (upstreamSignal?.aborted) throw error;
        // Timeout-triggered abort: retry silently.
        if (attempt === retries) throw error;
        await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
        continue;
      }
      console.warn(`Overpass attempt ${attempt} failed:`, error);
      if (attempt === retries) throw error;
      await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error("All Overpass retries failed");
}

function recalculateRoute(
  vehicle: SimVehicle,
  graph: RoadGraph,
  interferences: InterferenceZone[],
): SimVehicle {
  const blocked = buildBlockedEdges(graph, interferences);
  const startNode = findNearestGraphNode(
    graph,
    vehicle.currentPosition[0],
    vehicle.currentPosition[1],
  );
  let destinationNode = vehicle.destinationNode;
  let path = dijkstraPath(
    graph,
    startNode,
    destinationNode,
    blocked,
    interferences,
  );

  // If current destination is unreachable, pick any reachable destination.
  if (!path || path.length < 2) {
    const candidates = graph.nodes
      .map((_, idx) => idx)
      .filter((idx) => idx !== startNode);
    for (const candidate of candidates) {
      const altPath = dijkstraPath(
        graph,
        startNode,
        candidate,
        blocked,
        interferences,
      );
      if (altPath && altPath.length >= 2) {
        destinationNode = candidate;
        path = altPath;
        break;
      }
    }
  }

  if (!path || path.length < 2) {
    const epsilon = 0.00005;
    return {
      ...vehicle,
      route: [
        vehicle.currentPosition,
        [vehicle.currentPosition[0] + epsilon, vehicle.currentPosition[1] + epsilon],
      ],
      progressIndex: 0,
      destinationNode,
    };
  }

  const detour: LatLngTuple[] = [
    vehicle.currentPosition,
    ...coordsFromPath(graph, path).slice(1),
  ];
  return {
    ...vehicle,
    destinationNode,
    route: detour,
    progressIndex: 0,
  };
}

function MapHooks({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function SimulationCanvas({
  isPlaying = true,
  resetGeneration = 0,
  className = "",
  onTelemetryUpdate,
}: SimulationCanvasProps) {
  const [roadGraph, setRoadGraph] = useState<RoadGraph | null>(null);
  const [fleet, setFleet] = useState<SimVehicle[]>([]);
  const [activeInterferences, setActiveInterferences] = useState<InterferenceZone[]>([]);
  const [v2vLinks, setV2vLinks] = useState<Array<[LatLngTuple, LatLngTuple]>>([]);
  const [isLoadingRoads, setIsLoadingRoads] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [usingFallbackGraph, setUsingFallbackGraph] = useState(false);
  const [reloadRoadsTick, setReloadRoadsTick] = useState(0);

  const lastTsRef = useRef<number | null>(null);
  const nextZoneIdRef = useRef(1);
  const fallbackGraph = useMemo(() => generateFallbackRoadGraph(CENTER), []);

  const roadNetworkPolylines = useMemo(() => {
    if (!roadGraph) return [];
    const lines: LatLngTuple[][] = [];
    for (let i = 0; i < roadGraph.nodes.length; i++) {
      for (const j of roadGraph.nodes[i]!.neighbors) {
        if (j <= i) continue;
        lines.push([
          [roadGraph.nodes[i]!.lat, roadGraph.nodes[i]!.lng],
          [roadGraph.nodes[j]!.lat, roadGraph.nodes[j]!.lng],
        ]);
      }
    }
    return lines;
  }, [roadGraph]);

  useEffect(() => {
    let cancelled = false;
    const loadAbortController = new AbortController();

    const load = async () => {
      try {
        setIsLoadingRoads(true);
        setFetchFailed(false);
        setUsingFallbackGraph(false);
        console.log("ROAD_FETCH_START");
        const query =
          '[out:json];way[highway~"^(primary|secondary|tertiary|residential)$"](12.9600,77.5800,12.9850,77.6100);(._;>;);out;';
        const endpoints = [
          "https://overpass.kumi.systems/api/interpreter",
          "https://lz4.overpass-api.de/api/interpreter",
          "https://overpass-api.de/api/interpreter",
        ];
        const REQUEST_TIMEOUT_MS = 15000;
        const RETRIES_PER_ENDPOINT = 3;

        const fetchOverpass = async (): Promise<OverpassResponse> => {
          let lastError: unknown = null;
          for (const endpoint of endpoints) {
            try {
              const url = endpoint + "?data=" + encodeURIComponent(query);
              console.log("ROAD_FETCH_TRY", endpoint);
              const res = await fetchWithRetry(
                url,
                { method: "GET", signal: loadAbortController.signal },
                RETRIES_PER_ENDPOINT,
                REQUEST_TIMEOUT_MS,
              );
              console.log("ROAD_FETCH_OK", endpoint);
              return (await res.json()) as OverpassResponse;
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                throw error;
              }
              console.error("ROAD_FETCH_ENDPOINT_FAILED", endpoint, error);
              lastError = error;
            }
          }
          throw lastError ?? new Error("All Overpass mirrors failed");
        };

        const data = await fetchOverpass();
        console.log("ROAD_FETCH_ELEMENTS", data.elements?.length ?? 0);

        if (cancelled) return;

        const nodeDict: Record<number, { lat: number; lng: number }> = {};
        for (const el of data.elements ?? []) {
          if (el.type === "node") {
            nodeDict[el.id] = { lat: el.lat, lng: el.lon };
          }
        }

        const adjacencyList: Record<string, Array<{ node: string; distance: number }>> = {};
        const edgeSeen = new Set<string>();
        const addEdge = (from: string, to: string, distance: number) => {
          const edge = `${from}|${to}`;
          if (edgeSeen.has(edge)) return;
          edgeSeen.add(edge);
          if (!adjacencyList[from]) adjacencyList[from] = [];
          adjacencyList[from]!.push({ node: to, distance });
        };

        // Two-pass parser: pass-2 links only consecutive nodes in each way.
        for (const el of data.elements ?? []) {
          if (el.type !== "way" || !el.nodes || el.nodes.length < 2) continue;
          for (let i = 0; i < el.nodes.length - 1; i++) {
            const a = nodeDict[el.nodes[i]!];
            const b = nodeDict[el.nodes[i + 1]!];
            if (!a || !b) continue;
            const aKey = `${a.lat.toFixed(6)},${a.lng.toFixed(6)}`;
            const bKey = `${b.lat.toFixed(6)},${b.lng.toFixed(6)}`;
            const distance = segmentDistanceMeters(a, b);
            addEdge(aKey, bKey, distance);
            addEdge(bKey, aKey, distance);
          }
        }

        const keys = Object.keys(adjacencyList);
        if (keys.length < 2) throw new Error("Parsed adjacency list too small");
        console.log("ROAD_GRAPH_KEYS", keys.length);

        const keyToIndex = new Map<string, number>();
        const nodes: RoadNode[] = keys.map((key, idx) => {
          keyToIndex.set(key, idx);
          const [latS, lngS] = key.split(",");
          return { lat: Number(latS), lng: Number(lngS), neighbors: [] };
        });
        for (let i = 0; i < keys.length; i++) {
          const fromKey = keys[i]!;
          nodes[i]!.neighbors = (adjacencyList[fromKey] ?? [])
            .map((e) => keyToIndex.get(e.node))
            .filter((v): v is number => typeof v === "number");
        }

        if (cancelled) return;
        setRoadGraph({ nodes, adjacencyByKey: adjacencyList });
        setUsingFallbackGraph(false);
        console.log("ROAD_GRAPH_SET");
      } catch (err) {
        // 1. Differentiate between React unmount and API Timeout
        if (err instanceof DOMException && err.name === "AbortError") {
          if (loadAbortController.signal.aborted) {
            console.log("Fetch aborted cleanly by React unmount");
            return; // Safe to ignore React Strict Mode unmounts
          }
          // If we reach here, it was an API timeout! We want to fall through.
          console.warn("Fetch timed out! Proceeding to fallback graph.");
        }
        
        // 2. Load the fallback graph so vehicles can spawn
        if (!cancelled) {
          console.error("OVERPASS GRAPH FAILED", err);
          console.log("ROAD_GRAPH_USING_FALLBACK");
          setRoadGraph(fallbackGraph);
          setUsingFallbackGraph(true);
          setFetchFailed(false);
        }
      } finally {
        setIsLoadingRoads(false);
        console.log("ROAD_FETCH_DONE");
      }
    };

    void load();
    return () => {
      cancelled = true;
      loadAbortController.abort();
      setIsLoadingRoads(false);
    };
  }, [fallbackGraph, reloadRoadsTick]);

  useEffect(() => {
    if (!roadGraph) {
      setFleet(() => []);
      setV2vLinks([]);
      console.log("SPAWN_SKIPPED_NO_ROAD_GRAPH");
      return;
    }

    const keys = Object.keys(roadGraph.adjacencyByKey);
    const keyToIndex = new Map<string, number>();
    roadGraph.nodes.forEach((n, idx) => keyToIndex.set(`${n.lat.toFixed(6)},${n.lng.toFixed(6)}`, idx));
    if (keys.length < 2) {
      setFleet(() => []);
      setV2vLinks([]);
      console.error("SPAWN_FAILED_NOT_ENOUGH_ROAD_KEYS", keys.length);
      return;
    }

    const vehicleTargetCount = 4 + Math.floor(Math.random() * 2);
    const nextFleet: SimVehicle[] = [];

    for (let i = 0; i < vehicleTargetCount; i++) {
      let path: number[] | null = null;
      let srcIdx = 0;
      let dstIdx = 0;
      let attempts = 0;

      while ((!path || path.length < 2) && attempts < keys.length * keys.length * 2) {
        attempts++;
        let sourceKey = keys[Math.floor(Math.random() * keys.length)]!;
        let destinationKey = keys[Math.floor(Math.random() * keys.length)]!;
        while (destinationKey === sourceKey) {
          destinationKey = keys[Math.floor(Math.random() * keys.length)]!;
        }
        srcIdx = keyToIndex.get(sourceKey) ?? 0;
        dstIdx = keyToIndex.get(destinationKey) ?? srcIdx;
        path = dijkstraPath(roadGraph, srcIdx, dstIdx, new Set<string>(), []);
      }

      if (!path || path.length < 2) continue;
      const route = coordsFromPath(roadGraph, path);
      nextFleet.push({
        id: `vehicle-${i + 1}`,
        currentPosition: route[0]!,
        destinationNode: dstIdx,
        route,
        progressIndex: 0,
        knownInterferences: [],
      });
    }

    setFleet(() => nextFleet);
    setV2vLinks([]);
    lastTsRef.current = null;
    console.log("SPAWN_COMPLETE", nextFleet.length);
  }, [roadGraph, resetGeneration]);

  useEffect(() => {
    let raf = 0;
    const step = (ts: number) => {
      const prevTs = lastTsRef.current;
      lastTsRef.current = ts;
      const dt = !isPlaying || prevTs === null ? 1 / 60 : Math.min(0.05, Math.max(0, (ts - prevTs) / 1000));

      if (isPlaying && roadGraph) {
        let linksOut: Array<[LatLngTuple, LatLngTuple]> = [];
        let telemetryOut: { pdr: number; latency: number; throughput: number } | null =
          null;

        setFleet((prevFleet) => {
          if (prevFleet.length === 0) return prevFleet;
          const updated = prevFleet.map((v) => ({
            ...v,
            knownInterferences: [...v.knownInterferences],
            route: [...v.route],
          }));

          for (let i = 0; i < updated.length; i++) {
            const v = updated[i]!;
            let remaining = VEHICLE_SPEED_MPS * dt;
            while (remaining > 0 && v.route.length >= 2) {
              const segIdx = Math.floor(v.progressIndex);
              if (segIdx >= v.route.length - 1) break;
              const start = v.route[segIdx]!;
              const end = v.route[segIdx + 1]!;
              const segLen = Math.max(
                0.001,
                segmentDistanceMeters(
                  { lat: start[0], lng: start[1] },
                  { lat: end[0], lng: end[1] },
                ),
              );
              const local = v.progressIndex - segIdx;
              const toEnd = (1 - local) * segLen;
              if (remaining < toEnd) {
                v.progressIndex += remaining / segLen;
                const ratio = v.progressIndex - segIdx;
                v.currentPosition = [
                  start[0] + (end[0] - start[0]) * ratio,
                  start[1] + (end[1] - start[1]) * ratio,
                ];
                remaining = 0;
              } else {
                remaining -= toEnd;
                v.progressIndex = segIdx + 1;
                v.currentPosition = [end[0], end[1]];
              }
            }

            const touched = findImminentInterference(v, activeInterferences);
            if (touched && !v.knownInterferences.some((z) => z.id === touched.id)) {
              v.knownInterferences = [...v.knownInterferences, touched];
              updated[i] = recalculateRoute(v, roadGraph, v.knownInterferences);
            }
          }

          const links: Array<[LatLngTuple, LatLngTuple]> = [];
          for (let i = 0; i < updated.length; i++) {
            for (let j = i + 1; j < updated.length; j++) {
              const a = updated[i]!;
              const b = updated[j]!;
              const d = segmentDistanceMeters(
                { lat: a.currentPosition[0], lng: a.currentPosition[1] },
                { lat: b.currentPosition[0], lng: b.currentPosition[1] },
              );
              if (d <= V2V_RADIUS) {
                links.push([a.currentPosition, b.currentPosition]);
                const merged = mergeInterferences(
                  a.knownInterferences,
                  b.knownInterferences,
                );
                const aChanged = merged.length !== a.knownInterferences.length;
                const bChanged = merged.length !== b.knownInterferences.length;
                updated[i] = aChanged
                  ? recalculateRoute(
                      { ...a, knownInterferences: merged },
                      roadGraph,
                      merged,
                    )
                  : { ...a, knownInterferences: merged };
                updated[j] = bChanged
                  ? recalculateRoute(
                      { ...b, knownInterferences: merged },
                      roadGraph,
                      merged,
                    )
                  : { ...b, knownInterferences: merged };
              }
            }
          }

          const avgKnownInterferences =
            updated.reduce((sum, v) => sum + v.knownInterferences.length, 0) /
            Math.max(1, updated.length);
          const hopsFactor = links.length / Math.max(1, updated.length);
          telemetryOut = {
            pdr: Math.max(
              60,
              Math.min(
                99.5,
                97 -
                  activeInterferences.length * 2.8 -
                  avgKnownInterferences * 1.2 +
                  hopsFactor * 1.8,
              ),
            ),
            latency: Math.max(
              10,
              Math.min(
                200,
                28 +
                  activeInterferences.length * 18 +
                  avgKnownInterferences * 9 +
                  hopsFactor * 14,
              ),
            ),
            throughput: Math.max(
              120,
              Math.min(
                1200,
                920 -
                  activeInterferences.length * 120 -
                  avgKnownInterferences * 45 +
                  hopsFactor * 90,
              ),
            ),
          };
          linksOut = links;
          return updated;
        });

        setV2vLinks(linksOut);
        if (telemetryOut) onTelemetryUpdate?.(telemetryOut);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, roadGraph, activeInterferences]);

  return (
    <div
      className={`relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/60 shadow-inner ${className}`}
    >
      <MapContainer center={CENTER} zoom={15} scrollWheelZoom dragging className="h-full w-full">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapHooks
          onMapClick={(lat, lng) =>
            setActiveInterferences((prev) => [
              ...prev,
              { id: nextZoneIdRef.current++, lat, lng },
            ])
          }
        />

        {roadNetworkPolylines.map((line, idx) => (
          <Polyline key={`road-${idx}`} positions={line} pathOptions={{ color: "#374151", weight: 1, opacity: 0.45 }} />
        ))}

        {activeInterferences.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={ZONE_RADIUS_METERS}
            pathOptions={{ color: "red", fillColor: "#ef4444", fillOpacity: 0.4 }}
          />
        ))}

        {fleet.map((vehicle) =>
          vehicle.route.length >= 2 ? (
            <Polyline key={`route-${vehicle.id}`} positions={vehicle.route} pathOptions={{ color: "yellow", weight: 3, opacity: 0.65 }} />
          ) : null,
        )}

        {fleet.map((vehicle) => {
          if (vehicle.route.length < 2) return null;
          const source = vehicle.route[0]!;
          return (
            <CircleMarker
              key={`source-${vehicle.id}`}
              center={source}
              radius={5}
              pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.95, weight: 1 }}
            />
          );
        })}

        {fleet.map((vehicle) => {
          if (vehicle.route.length < 2) return null;
          const destination = vehicle.route[vehicle.route.length - 1]!;
          return (
            <CircleMarker
              key={`destination-${vehicle.id}`}
              center={destination}
              radius={5}
              pathOptions={{ color: "#a855f7", fillColor: "#a855f7", fillOpacity: 0.95, weight: 1 }}
            />
          );
        })}

        {v2vLinks.map((link, idx) => (
          <Polyline
            key={`v2v-${idx}`}
            positions={link}
            pathOptions={{ color: "#22d3ee", weight: 2, opacity: 0.95, dashArray: "5, 8" }}
          />
        ))}

        {fleet.map((vehicle) => (
          <CircleMarker
            key={vehicle.id}
            center={vehicle.currentPosition}
            radius={6}
            pathOptions={{ color: "#0891b2", fillColor: "#22d3ee", fillOpacity: 0.95, weight: 1 }}
          />
        ))}
      </MapContainer>

      <button
        type="button"
        onClick={() => setReloadRoadsTick((n) => n + 1)}
        className="absolute right-3 top-3 z-[1002] rounded-md border border-slate-500/60 bg-slate-900/90 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
      >
        Reload Roads
      </button>

      {isLoadingRoads && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-slate-950/55">
          <div className="rounded-md border border-slate-500/50 bg-slate-900/90 px-4 py-2 text-sm font-medium text-slate-100">
            Loading road network...
          </div>
        </div>
      )}
      {fetchFailed && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1001] rounded-md border border-red-500/40 bg-red-950/70 px-3 py-2 text-xs text-red-100">
          Failed to load road network (Overpass error).
        </div>
      )}
      {usingFallbackGraph && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[1001] rounded-md border border-amber-500/40 bg-amber-950/70 px-3 py-2 text-xs text-amber-100">
          Using synthetic road network (Overpass unavailable).
        </div>
      )}
    </div>
  );
}
