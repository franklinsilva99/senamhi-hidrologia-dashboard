"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADO_COLOR, PERU_BOUNDS, stationDotColorIcon } from "@/lib/mapIcons";
import HidrogramaMonitoreoPopup from "@/components/HidrogramaMonitoreoPopup";
import { getLatestMerged, getSeriesMerged } from "@/lib/data";
import { clasificarUmbral } from "@/lib/queries";
import { getConfigMap, type ConfigEstacion } from "@/lib/configEstacion";
import type { Observation, Station } from "@/lib/types";

const NIVEL_TO_ESTADO: Record<string, string> = {
  AMARILLO: "amarilla",
  NARANJA: "naranja",
  ROJO: "roja",
};

export default function MapMonitoreo({
  stations,
  heightClass = "h-[900px]",
}: {
  stations: Station[];
  heightClass?: string;
}) {
  const [latest, setLatest] = useState<Record<string, Observation>>({});
  const [configMap, setConfigMap] = useState<Record<string, ConfigEstacion>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serie, setSerie] = useState<Observation[]>([]);

  useEffect(() => {
    setLatest(getLatestMerged());
    setConfigMap(getConfigMap());
  }, []);

  useEffect(() => {
    setSerie(selectedId ? getSeriesMerged(selectedId) : []);
  }, [selectedId]);

  const selected = selectedId ? stations.find((s) => s.id === selectedId) ?? null : null;
  const selectedConfig = selected ? configMap[selected.id] : undefined;

  // Color del punto según la preferencia (caudal/nivel) contra sus umbrales; gris si está en mantenimiento
  const colorDe = (s: Station): string => {
    const c = configMap[s.id];
    if (!c) return ESTADO_COLOR.normal;
    if (c.estado === "mantenimiento") return "#9ca3af";
    const obs = latest[s.id];
    if (!obs) return ESTADO_COLOR.normal;
    const valor = c.preferencia === "caudal" ? obs.caudal : obs.nivel;
    const umbral = clasificarUmbral(valor, c, c.preferencia);
    return umbral ? ESTADO_COLOR[NIVEL_TO_ESTADO[umbral]] ?? ESTADO_COLOR.normal : ESTADO_COLOR.normal;
  };

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
          const sel = selectedId === s.id;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lon]}
              icon={stationDotColorIcon(colorDe(s), sel)}
              eventHandlers={{ click: () => setSelectedId(s.id) }}
            >
              <Tooltip direction="top" offset={[0, -28]}>{s.estacion}</Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {selected && selectedConfig && (
        <div className="absolute top-2 inset-x-0 flex justify-center z-[1100] px-2">
          <HidrogramaMonitoreoPopup
            station={selected}
            series={serie}
            config={selectedConfig}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
