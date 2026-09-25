"use client";
import dynamic from "next/dynamic";
import type { Station } from "@/lib/types";

const MapMonitoreo = dynamic(() => import("@/components/MapMonitoreo"), { ssr: false });

export default function MapMonitoreoClient(props: { stations: Station[]; heightClass?: string }) {
  return <MapMonitoreo {...props} />;
}
