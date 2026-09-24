"use client";
import dynamic from "next/dynamic";
import type { ForecastDiario, Station } from "@/lib/types";

const MapPronostico = dynamic(() => import("@/components/MapPronostico"), { ssr: false });

export default function MapPronosticoClient(props: {
  stations: Station[];
  forecastPorEstacion: Record<string, ForecastDiario[]>;
  nivelPorEstacion: Record<string, string>;
  heightClass?: string;
}) {
  return <MapPronostico {...props} />;
}
