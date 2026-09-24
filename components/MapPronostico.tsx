"use client";
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ESTADO_COLOR, PERU_BOUNDS, stationIcon } from "@/lib/mapIcons";
import type { ForecastDiario, Station } from "@/lib/types";

const NIVEL_COLOR: Record<string, string> = {
  ROJO: "#ee3d43",
  NARANJA: "#fca326",
  AMARILLO: "#ffeb3b",
  normal: "#16a34a",
};

export default function MapPronostico({
  stations,
  forecastPorEstacion,
  nivelPorEstacion,
  heightClass = "h-[480px]",
}: {
  stations: Station[];
  forecastPorEstacion: Record<string, ForecastDiario[]>;
  nivelPorEstacion: Record<string, string>;
  heightClass?: string;
}) {
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
          const pron = forecastPorEstacion[s.id] ?? [];
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lon]}
              icon={stationIcon(NIVEL_COLOR[nivel] ?? ESTADO_COLOR.normal)}
            >
              <Tooltip direction="top" offset={[0, -28]}>{s.estacion}</Tooltip>
              <Popup>
                <b>{s.estacion}</b>
                <br />Río {s.rio} ({s.dz ?? "—"})
                <br />
                <span className="font-semibold">Pronóstico</span>
                <br />
                {pron.length ? (
                  pron.map((p) => (
                    <span key={p.fecha}>
                      {p.fecha}: <b>{p.caudalPrevisto}</b> m³/s · {p.nModelos} modelo(s)
                      <br />
                    </span>
                  ))
                ) : (
                  <span>sin datos</span>
                )}
                <span className="font-semibold">Nivel pronosticado: {nivel}</span>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
