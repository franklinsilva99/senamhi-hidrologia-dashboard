"use client";
import dynamic from "next/dynamic";
import type { Observation, Station } from "@/lib/domain/types";

const MapHydro = dynamic(() => import("@/components/MapHydro"), { ssr: false });

export default function MapClient({
  stations,
  latest,
}: {
  stations: Station[];
  latest: Record<string, Observation>;
}) {
  return <MapHydro stations={stations} latest={latest} />;
}
