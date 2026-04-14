export const ROUTING_ALGORITHMS = ["AODV", "DSDV", "Dijkstra"] as const;

export type RoutingAlgorithm = (typeof ROUTING_ALGORITHMS)[number];
