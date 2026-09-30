"use client";
import dynamic from "next/dynamic";

const MapMonitoreo = dynamic(() => import("@/components/MapMonitoreo"), { ssr: false });

export default function MapMonitoreoClient(props: { heightClass?: string }) {
  return <MapMonitoreo {...props} />;
}
