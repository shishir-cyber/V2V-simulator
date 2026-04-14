const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Undirected graph: edge (i,j) when centers are within `rangeMeters`.
 */
export function buildAdjacency(
  vehicles: { lat: number; lng: number }[],
  rangeMeters: number,
): number[][] {
  const n = vehicles.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = vehicles[i]!;
    for (let j = i + 1; j < n; j++) {
      const b = vehicles[j]!;
      if (distanceMeters(a, b) >= rangeMeters) continue;
      adj[i]!.push(j);
      adj[j]!.push(i);
    }
  }
  return adj;
}

/** Unweighted shortest path (fewest hops), same as Dijkstra with unit edge weight. */
export function bfsShortestPath(
  adj: number[][],
  start: number,
  end: number,
): number[] | null {
  const n = adj.length;
  if (start < 0 || end < 0 || start >= n || end >= n) return null;
  if (start === end) return [start];

  const visited = new Uint8Array(n);
  const prev = new Array<number>(n).fill(-1);
  const queue: number[] = [start];
  visited[start] = 1;
  prev[start] = -1;

  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++]!;
    for (const v of adj[u]!) {
      if (visited[v]) continue;
      visited[v] = 1;
      prev[v] = u;
      if (v === end) {
        const out: number[] = [];
        let c = end;
        for (;;) {
          out.push(c);
          if (c === start) break;
          c = prev[c]!;
        }
        out.reverse();
        return out;
      }
      queue.push(v);
    }
  }
  return null;
}

/**
 * Weighted shortest path for dynamic edge costs.
 */
export function dijkstraShortestPath(
  adj: number[][],
  start: number,
  end: number,
  getWeight: (from: number, to: number) => number,
): number[] | null {
  const n = adj.length;
  if (start < 0 || end < 0 || start >= n || end >= n) return null;
  if (start === end) return [start];

  const dist = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(n).fill(-1);
  const visited = new Uint8Array(n);
  dist[start] = 0;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i]!;
        u = i;
      }
    }
    if (u < 0 || !Number.isFinite(best)) break;
    if (u === end) break;
    visited[u] = 1;

    for (const v of adj[u]!) {
      if (visited[v]) continue;
      const w = getWeight(u, v);
      if (!Number.isFinite(w) || w < 0) continue;
      const alt = dist[u]! + w;
      if (alt < dist[v]!) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  if (!Number.isFinite(dist[end]!)) return null;
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

function shuffleIndices(indices: number[]): void {
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = t;
  }
}

/** All node indices reachable from `start` in the transmission graph. */
export function bfsReachableIndices(adj: number[][], start: number): Set<number> {
  const seen = new Set<number>();
  const q: number[] = [start];
  seen.add(start);
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++]!;
    for (const v of adj[u]!) {
      if (seen.has(v)) continue;
      seen.add(v);
      q.push(v);
    }
  }
  return seen;
}

/**
 * Prefer a Source/Destination pair in the same connected component with a
 * multi-hop shortest path (≥3 nodes). Falls back to any connected pair, then random.
 */
export function pickSmartSourceDestIds(
  vehicles: { id: number; lat: number; lng: number }[],
  rangeMeters: number,
): { sourceId: number; destId: number } | null {
  const n = vehicles.length;
  if (n < 2) return null;

  const adj = buildAdjacency(vehicles, rangeMeters);
  const sourceOrder = Array.from({ length: n }, (_, i) => i);
  shuffleIndices(sourceOrder);

  const maxSourceTries = Math.min(48, Math.max(n, 12));

  for (let a = 0; a < maxSourceTries; a++) {
    const si = sourceOrder[a % n]!;
    const comp = bfsReachableIndices(adj, si);
    if (comp.size < 2) continue;

    const others = [...comp].filter((j) => j !== si);
    shuffleIndices(others);
    const cap = Math.min(others.length, 40);

    for (let k = 0; k < cap; k++) {
      const di = others[k]!;
      const path = bfsShortestPath(adj, si, di);
      if (path && path.length >= 3) {
        return { sourceId: vehicles[si]!.id, destId: vehicles[di]!.id };
      }
    }
    for (let k = 0; k < cap; k++) {
      const di = others[k]!;
      const path = bfsShortestPath(adj, si, di);
      if (path && path.length >= 2) {
        return { sourceId: vehicles[si]!.id, destId: vehicles[di]!.id };
      }
    }
  }

  return pickRandomSourceDestIds(vehicles.map((v) => v.id));
}

export function pickRandomSourceDestIds(
  ids: number[],
): { sourceId: number; destId: number } | null {
  if (ids.length < 2) return null;
  let i = Math.floor(Math.random() * ids.length);
  let j = Math.floor(Math.random() * ids.length);
  while (j === i) j = Math.floor(Math.random() * ids.length);
  return { sourceId: ids[i]!, destId: ids[j]! };
}

export function packetPositionAlongPath(
  vehicles: { lat: number; lng: number }[],
  pathIndices: number[],
  t: number,
): { lat: number; lng: number } | null {
  if (pathIndices.length === 0) return null;
  if (pathIndices.length === 1) {
    const v = vehicles[pathIndices[0]!]!;
    return { lat: v.lat, lng: v.lng };
  }

  const segLens: number[] = [];
  let total = 0;
  for (let k = 0; k < pathIndices.length - 1; k++) {
    const a = vehicles[pathIndices[k]!]!;
    const b = vehicles[pathIndices[k + 1]!]!;
    const len = distanceMeters(a, b);
    segLens.push(len);
    total += len;
  }

  if (total < 1e-6) {
    const v = vehicles[pathIndices[0]!]!;
    return { lat: v.lat, lng: v.lng };
  }

  let dist = ((t % 1) + 1) % 1;
  dist *= total;

  for (let k = 0; k < pathIndices.length - 1; k++) {
    const segLen = segLens[k]!;
    if (dist <= segLen) {
      const ratio = segLen > 0 ? dist / segLen : 0;
      const a = vehicles[pathIndices[k]!]!;
      const b = vehicles[pathIndices[k + 1]!]!;
      return {
        lat: a.lat + ratio * (b.lat - a.lat),
        lng: a.lng + ratio * (b.lng - a.lng),
      };
    }
    dist -= segLen;
  }

  const last = vehicles[pathIndices[pathIndices.length - 1]!]!;
  return { lat: last.lat, lng: last.lng };
}
