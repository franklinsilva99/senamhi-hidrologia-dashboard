"use client";
import dynamic from "next/dynamic";
import type { ForecastDiario, ForecastInput, Station } from "@/lib/types";

const MapPronostico = dynamic(() => import("@/components/MapPronostico"), { ssr: false });

export default function MapPronosticoClient(props: {
  stations: Station[];
  forecastPorEstacion: Record<string, ForecastDiario[]>;
  inputsPorEstacion: Record<string, ForecastInput[]>;
  nivelPorEstacion: Record<string, string>;
  umbralesPorEstacion: Record<string, { amarilla: number; naranja: number; roja: number }>;
  heightClass?: string;
}) {
  return <MapPronostico {...props} />;
}
