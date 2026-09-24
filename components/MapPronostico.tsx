"use client";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADO_COLOR, PERU_BOUNDS, stationIcon } from "@/lib/mapIcons";
import HidrogramaPronosticoPopup from "@/components/HidrogramaPronosticoPopup";
import type { ForecastDiario, ForecastInput, Station } from "@/lib/types";

const NIVEL_COLOR: Record<string, string> = {
  ROJO: "#ee3d43",
  NARANJA: "#fca326",
  AMARILLO: "#ffeb3b",
  normal: "#16a34a",
};

export default function MapPronostico({
  stations,
  forecastPorEstacion,
  inputsPorEstacion,
  nivelPorEstacion,
  umbralesPorEstacion,
  heightClass = "h-[960px]",
}: {
  stations: Station[];
  forecastPorEstacion: Record<string, ForecastDiario[]>;
  inputsPorEstacion: Record<string, ForecastInput[]>;
  nivelPorEstacion: Record<string, string>;
  umbralesPorEstacion: Record<string, { amarilla: number; naranja: number; roja: number }>;
  heightClass?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? stations.find((s) => s.id === selectedId) : null;

  return (
    <div className="relative">
      <MapContainer
        bounds={PERU_BOUNDS}
        boundsOptions={{ padding: [8, 8] }}
        scrollWheelZoom={false}
        className={`${heightClass} w-full rounded-xl border z-0`}
      >
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {stations.map((s) => {
          const nivel = nivelPorEstacion[s.id] ?? "normal";
          const sel = selectedId === s.id;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lon]}
              icon={stationIcon(NIVEL_COLOR[nivel] ?? ESTADO_COLOR.normal, sel)}
              eventHandlers={{ click: () => setSelectedId(s.id) }}
            >
              <Tooltip direction="top" offset={[0, -28]}>{s.estacion}</Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {selected && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1100]">
          <HidrogramaPronosticoPopup
            station={selected}
            umbrales={umbralesPorEstacion[selected.id] ?? { amarilla: 0, naranja: 0, roja: 0 }}
            forecast={forecastPorEstacion[selected.id] ?? []}
            inputs={inputsPorEstacion[selected.id] ?? []}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
