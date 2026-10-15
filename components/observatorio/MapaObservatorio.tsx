"use client";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PERU_BOUNDS } from "@/lib/ui/mapIcons";
import type { Station } from "@/lib/domain/types";

// ── Mapa del observatorio: una capa por producto (Monitoreo / Avisos /
// Pronóstico). Cada estación muestra un chip con su dato; al hacer clic se
// selecciona y el resto de tarjetas de la página se actualiza.

export type Capa = "monitoreo" | "avisos" | "pronostico";

export interface PuntoMapa {
  station: Station;
  etiqueta: string | null; // texto del chip (valor); null = sin dato en esta capa
  color: string; // color del chip según nivel
  texto: string; // color del texto del chip
  halo?: string | null; // capa avisos: halo del nivel del aviso vigente
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function icono(p: PuntoMapa, seleccionado: boolean) {
  const halo = p.halo
    ? `<span style="position:absolute;left:-13px;top:-13px;width:38px;height:38px;border-radius:999px;background:${p.halo};opacity:.35;animation:obs-pulso 1.8s ease-out infinite"></span>`
    : "";
  const anillo = seleccionado ? "box-shadow:0 0 0 3px #002259,0 0 0 5px #fff;" : "";
  const chip = p.etiqueta
    ? `<span style="position:absolute;left:16px;top:-9px;white-space:nowrap;padding:1px 7px;border-radius:999px;background:${p.color};color:${p.texto};font:700 11px/16px var(--font-inter),system-ui,sans-serif;border:1.5px solid rgba(0,0,0,.25);box-shadow:0 1px 3px rgba(0,0,0,.25)">${esc(p.etiqueta)}</span>`
    : "";
  return L.divIcon({
    className: "obs-marker",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `<div style="position:relative;width:12px;height:12px">${halo}<span style="position:absolute;inset:0;border-radius:999px;background:#fff;border:2.5px solid #073763;${anillo}"></span>${chip}</div>`,
  });
}

function Volar({ destino }: { destino: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (destino) map.flyTo(destino, Math.max(map.getZoom(), 7), { duration: 0.8 });
  }, [destino, map]);
  return null;
}

export default function MapaObservatorio({
  puntos,
  seleccionId,
  onSeleccionar,
  poblados,
}: {
  puntos: PuntoMapa[];
  seleccionId: string | null;
  onSeleccionar: (id: string) => void;
  // Centros poblados del aviso de la estación seleccionada (capa avisos).
  poblados: { nombre: string; lat: number; lon: number }[];
}) {
  const sel = puntos.find((p) => p.station.id === seleccionId)?.station;
  return (
    <MapContainer
      bounds={PERU_BOUNDS}
      boundsOptions={{ padding: [10, 10] }}
      scrollWheelZoom
      className="h-full w-full"
      zoomControl
    >
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Volar destino={sel ? [sel.lat, sel.lon] : null} />
      {puntos.map((p) => (
        <Marker
          key={p.station.id}
          position={[p.station.lat, p.station.lon]}
          icon={icono(p, p.station.id === seleccionId)}
          eventHandlers={{ click: () => onSeleccionar(p.station.id) }}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            <strong>{p.station.estacion}</strong> · Río {p.station.rio}
          </Tooltip>
        </Marker>
      ))}
      {poblados.map((c) => (
        <Marker
          key={c.nombre}
          position={[c.lat, c.lon]}
          icon={L.divIcon({
            className: "obs-marker",
            iconSize: [14, 14],
            iconAnchor: [7, 14],
            html: `<span style="display:block;width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#16a34a;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
          })}
        >
          <Tooltip direction="top" offset={[0, -12]}>Centro poblado: {c.nombre}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
