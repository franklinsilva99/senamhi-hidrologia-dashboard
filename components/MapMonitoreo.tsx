"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADO_COLOR, PERU_BOUNDS, stationDotColorIcon } from "@/lib/mapIcons";
import HidrogramaMonitoreoPopup from "@/components/HidrogramaMonitoreoPopup";
import { getLatestMerged, getSeriesMerged } from "@/lib/data";
import { getThresholds } from "@/lib/queries";
import type { Observation, Station } from "@/lib/types";

export default function MapMonitoreo({
  stations,
  heightClass = "h-[900px]",
}: {
  stations: Station[];
  heightClass?: string;
}) {
  const [latest, setLatest] = useState<Record<string, Observation>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serie, setSerie] = useState<Observation[]>([]);

  useEffect(() => {
    setLatest(getLatestMerged());
  }, []);

  useEffect(() => {
    setSerie(selectedId ? getSeriesMerged(selectedId) : []);
  }, [selectedId]);

  const selected = selectedId ? stations.find((s) => s.id === selectedId) ?? null : null;
  const th = selected ? getThresholds().find((t) => t.stationId === selected.id) : undefined;

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
          const estado = latest[s.id]?.estado ?? "normal";
          const sel = selectedId === s.id;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lon]}
              icon={stationDotColorIcon(ESTADO_COLOR[estado] ?? ESTADO_COLOR.normal, sel)}
              eventHandlers={{ click: () => setSelectedId(s.id) }}
            >
              <Tooltip direction="top" offset={[0, -28]}>{s.estacion}</Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {selected && th && (
        <div className="absolute top-2 inset-x-0 flex justify-center z-[1100] px-2">
          <HidrogramaMonitoreoPopup
            station={selected}
            series={serie}
            preferencia={th.preferencia}
            tipo={th.tipo}
            cota={selected.cota}
            umbralAmarilla={th.preferencia === "nivel" ? th.nivel.amarilla : th.caudal.amarilla}
            umbralNaranja={th.preferencia === "nivel" ? th.nivel.naranja : th.caudal.naranja}
            umbralRoja={th.preferencia === "nivel" ? th.nivel.roja : th.caudal.roja}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
