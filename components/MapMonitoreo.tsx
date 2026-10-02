"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADO_COLOR, PERU_BOUNDS, stationDotColorIcon } from "@/lib/ui/mapIcons";
import HidrogramaMonitoreoPopup from "@/components/HidrogramaMonitoreoPopup";
import { getLatestMerged, getSeriesMerged, getMockNow } from "@/lib/infra/data";
import { clasificarNivel } from "@/lib/domain/umbrales";
import { getConfigVigente } from "@/lib/infra/configRecords";
import { getStationsConfig } from "@/lib/infra/stationConfig";
import type { Observation, Station } from "@/lib/domain/types";

const NIVEL_TO_ESTADO: Record<string, string> = {
  AMARILLO: "amarilla",
  NARANJA: "naranja",
  ROJO: "roja",
};

export default function MapMonitoreo({
  heightClass = "h-[900px]",
}: {
  heightClass?: string;
}) {
  const [stations, setStations] = useState<Station[]>([]);
  const [latest, setLatest] = useState<Record<string, Observation>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serie, setSerie] = useState<Observation[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setStations(getStationsConfig());
    setLatest(getLatestMerged());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la serie con la estación seleccionada
    setSerie(selectedId ? getSeriesMerged(selectedId) : []);
  }, [selectedId]);

  const selected = selectedId ? stations.find((s) => s.id === selectedId) ?? null : null;

  // Color del punto según la preferencia (caudal/nivel) contra sus umbrales; gris si está en mantenimiento
  const colorDe = (s: Station): string => {
    if (s.estado === "mantenimiento") return "#9ca3af";
    const obs = latest[s.id];
    if (!obs) return ESTADO_COLOR.normal;
    const preferencia = s.preferencia ?? "caudal";
    const tipo = s.tipo ?? "avenida";
    const record = getConfigVigente(s.id, preferencia, getMockNow());
    if (!record) return ESTADO_COLOR.normal;
    const u = record.umbrales[tipo];
    if (!u) return ESTADO_COLOR.normal;
    const valor = preferencia === "caudal" ? obs.caudal : obs.nivel;
    const umbral = clasificarNivel(valor, u, tipo);
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

      {selected && (
        <div className="absolute top-2 inset-x-0 flex justify-center z-[1100] px-2">
          <HidrogramaMonitoreoPopup
            key={selected.id}
            station={selected}
            series={serie}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
