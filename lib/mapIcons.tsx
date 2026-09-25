import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Colores por estado de la última lectura (verde=normal … rojo)
export const ESTADO_COLOR: Record<string, string> = {
  normal: "#16a34a",
  amarilla: "#ffeb3b",
  naranja: "#fca326",
  roja: "#ee3d43",
};

export const PERU_BOUNDS: [[number, number], [number, number]] = [
  [-16.88, -80.32],
  [-1.43, -69.66],
];

export type FlyTarget = {
  bounds: [number, number][];
  maxZoom?: number;
};

function stationGlyph(c: string, size = 16, strokeWidth = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="12" fill="none" stroke="${c}" stroke-width="${strokeWidth}"/>
      <circle cx="14" cy="14" r="7.5" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="14" cy="14" r="4" fill="${c}"/>
    </svg>`;
}

function pinGlyph(w = 14, h = 21) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 20 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0 C4.48 0 0 4.48 0 10 C0 17 10 30 10 30 C10 30 20 17 20 10 C20 4.48 15.52 0 10 0 Z" fill="#16a34a"/>
      <circle cx="10" cy="10" r="4" fill="#ffffff"/>
    </svg>`;
}

export function stationIcon(c: string, selected = false) {
  const outerW = selected ? 3.5 : 2;
  return L.divIcon({
    className: "marker-station",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: stationGlyph(c, 28, outerW),
  });
}

export function pinIcon() {
  return L.divIcon({
    className: "marker-pin",
    iconSize: [20, 30],
    iconAnchor: [10, 30],
    html: pinGlyph(20, 30),
  });
}

// Punto de estación para el mapa de pronóstico (relleno #4682B4, borde #073763)
function dotGlyph(r: number) {
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="${r}" fill="#4682B4" stroke="#073763" stroke-width="1.5"/>
    </svg>`;
}

export function stationDotIcon(selected = false) {
  return L.divIcon({
    className: "marker-station",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: dotGlyph(selected ? 8.5 : 7.5),
  });
}

// Punto con relleno variable (para el mapa de monitoreo: color segun estado/umbral)
function dotColorGlyph(fill: string, r: number) {
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="${r}" fill="${fill}" stroke="#073763" stroke-width="1.5"/>
    </svg>`;
}

export function stationDotColorIcon(fill: string, selected = false) {
  return L.divIcon({
    className: "marker-station",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: dotColorGlyph(fill, selected ? 8.5 : 7.5),
  });
}

export function MapController({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyToBounds(target.bounds, {
        padding: [40, 40],
        maxZoom: target.maxZoom ?? 18,
        duration: 0.8,
      });
    }
  }, [target, map]);
  return null;
}
