"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NivelAlerta, Observation, Station, TipoAviso } from "@/lib/types";
import {
  NIVELES,
  NIVEL_LABEL,
  NIVEL_SENAMHI,
  PELIGRO,
  RECOMENDACION,
  type NivelKey,
} from "@/lib/nivelesPeligro";

const color: Record<string, string> = {
  normal: "#16a34a",
  amarilla: "#ffeb3b",
  naranja: "#fca326",
  roja: "#ee3d43",
};

const PERU_BOUNDS: [[number, number], [number, number]] = [
  [-16.88, -80.32],
  [-1.43, -69.66],
];

type FlyTarget = {
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

function stationIcon(c: string, selected = false) {
  const outerW = selected ? 3.5 : 2;
  return L.divIcon({
    className: "marker-station",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: stationGlyph(c, 28, outerW),
  });
}

function pinIcon() {
  return L.divIcon({
    className: "marker-pin",
    iconSize: [20, 30],
    iconAnchor: [10, 30],
    html: pinGlyph(20, 30),
  });
}

// Sección del panel SENAMHI (encabezado cian + valor en blanco)
function Seccion({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">{titulo}</p>
      <p className="text-[11px] leading-snug text-white/90">{valor}</p>
    </div>
  );
}

function MapController({ target }: { target: FlyTarget | null }) {
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

export default function MapHydro({
  stations,
  latest,
  heightClass = "h-[420px]",
  vigenteIds,
  tipoPorEstacion,
  nivelPorEstacion,
  avisoIdPorEstacion,
  tipoDefault = "avenida",
  mostrarNiveles = false,
}: {
  stations: Station[];
  latest: Record<string, Observation>;
  heightClass?: string;
  vigenteIds?: Set<string>;
  tipoPorEstacion?: Record<string, TipoAviso>;
  nivelPorEstacion?: Record<string, NivelAlerta>;
  avisoIdPorEstacion?: Record<string, string>;
  tipoDefault?: TipoAviso;
  mostrarNiveles?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [nivelActivo, setNivelActivo] = useState<NivelKey>("AMARILLO");
  const [tipoActivo, setTipoActivo] = useState<TipoAviso>(tipoDefault);

  useEffect(() => {
    setTipoActivo(tipoDefault);
  }, [tipoDefault]);

  const handleStationClick = (s: Station) => {
    if (!vigenteIds?.has(s.id)) return;
    const pts: [number, number][] = [
      [s.lat, s.lon],
      ...(s.pobladosGeo ?? []).map((p) => [p.lat, p.lon] as [number, number]),
    ];
    setSelectedId(s.id);
    // Sincroniza el tipo (avenida/vigilancia) con la estación seleccionada
    if (tipoPorEstacion?.[s.id]) setTipoActivo(tipoPorEstacion[s.id]);
    // Sincroniza el chip de nivel con el nivel del aviso vigente
    if (nivelPorEstacion?.[s.id]) setNivelActivo(nivelPorEstacion[s.id]);
    setFlyTarget({
      bounds:
        pts.length >= 2
          ? pts
          : [
              [s.lat - 0.08, s.lon - 0.08],
              [s.lat + 0.08, s.lon + 0.08],
            ],
      maxZoom: 12,
    });
  };

  const resetView = () => {
    setSelectedId(null);
    setTipoActivo(tipoDefault);
    setFlyTarget({ bounds: [PERU_BOUNDS[0], PERU_BOUNDS[1]] });
  };

  const selected = selectedId ? stations.find((s) => s.id === selectedId) : null;
  const enDetalle = !!(selected && vigenteIds?.has(selected.id) && mostrarNiveles);
  const nivelSeleccionado =
    (selected && nivelPorEstacion?.[selected.id]) || null;
  const avisoId = selected && enDetalle ? avisoIdPorEstacion?.[selected.id] : undefined;

  return (
    <div className={`relative${mostrarNiveles ? " overflow-hidden" : ""}`}>
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
        <MapController target={flyTarget} />
        {stations.map((s) => {
          const o = latest[s.id];
          const est = o?.estado ?? "normal";
          const sel = selectedId === s.id;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lon]}
              icon={stationIcon(color[est] ?? color.normal, sel)}
              eventHandlers={{ click: () => handleStationClick(s) }}
            >
              <Popup>
                <b>{s.rio} — {s.estacion}</b>
                <br />Q: {o?.caudal} m³/s · N: {o?.nivel} m
                <br />Estado: {est} · QC1: {o?.origen}
                <br />DZ: {s.dz ?? "—"} · {s.poblados.join(", ")}
              </Popup>
            </Marker>
          );
        })}
        {selected && vigenteIds?.has(selected.id)
          ? (selected.pobladosGeo ?? []).map((p) => (
              <Marker
                key={`${selected.id}-${p.nombre}`}
                position={[p.lat, p.lon]}
                icon={pinIcon()}
              >
                <Tooltip direction="top" offset={[0, -28]}>{p.nombre}</Tooltip>
                <Popup>
                  <b>{p.nombre}</b>
                  <br />Centro poblado afectado
                  <br />Estación {selected.estacion}
                </Popup>
              </Marker>
            ))
          : null}
      </MapContainer>
      {selected && (
        <button
          type="button"
          onClick={resetView}
          className="absolute top-2 right-2 z-[1000] bg-[#003366] text-white text-xs font-semibold px-3 py-1.5 rounded shadow hover:bg-[#00539b]"
        >
          Restablecer vista
        </button>
      )}
      {mostrarNiveles && (
        <div
          className={`absolute bottom-2 left-2 z-[500] flex items-start transition-transform duration-300 ${
            legendOpen ? "translate-x-0" : "-translate-x-[281px]"
          }`}
        >
          <div className="w-[281px] max-h-[560px] overflow-y-auto rounded-l bg-black/60 px-3 py-2 text-white shadow-sm">
            {enDetalle && selected ? (
              <>
                <p className="text-center text-[1.2rem] font-bold leading-tight text-[#dc3545]">
                  ESTACIÓN {selected.estacion.toUpperCase()}
                </p>
                {nivelSeleccionado && (
                  <div className="mt-1.5 flex justify-center">
                    <span
                      className="rounded px-2.5 py-0.5 text-[11px] font-bold uppercase"
                      style={{
                        backgroundColor: NIVEL_SENAMHI[nivelSeleccionado].bg,
                        color: NIVEL_SENAMHI[nivelSeleccionado].text,
                        boxShadow: "0 0 1px 1px rgba(0,0,0,.35)",
                      }}
                    >
                      Nivel {NIVEL_LABEL[nivelSeleccionado]}
                    </span>
                  </div>
                )}
                <hr className="my-2 border-t border-white/30" />
                <Seccion titulo="Centros poblados" valor={selected.poblados.join(", ")} />
                <Seccion titulo="Departamento" valor={selected.departamento} />
                <Seccion titulo="Provincia" valor={selected.provincia.join(", ")} />
                <Seccion titulo="Distritos" valor={selected.distritos.join(", ")} />
                <hr className="my-2 border-t border-white/30" />
              </>
            ) : (
              <p className="text-center text-[1.2rem] font-bold leading-tight text-[#dc3545]">
                NIVELES DE PELIGRO
              </p>
            )}
            <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px]">
              <span className="text-white/60">Tipo:</span>
              {(["avenida", "vigilancia"] as TipoAviso[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoActivo(t)}
                  className={`rounded px-1.5 py-0.5 ${
                    tipoActivo === t
                      ? "bg-white/20 font-bold text-white"
                      : "text-[#c9c9c9]"
                  }`}
                >
                  {t === "avenida" ? "Avenida" : "Vigilancia"}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              {NIVELES.map((n) => {
                const activo = nivelActivo === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNivelActivo(n)}
                    className={`flex-1 px-1 py-0.5 text-[11px] font-bold ${activo ? "" : "text-[#c9c9c9]"}`}
                    style={
                      activo
                        ? {
                            backgroundColor: NIVEL_SENAMHI[n].bg,
                            color: NIVEL_SENAMHI[n].text,
                            boxShadow: "0 0 1px 1px rgba(0,0,0,.35)",
                          }
                        : undefined
                    }
                  >
                    {NIVEL_LABEL[n]}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[11px]">
              <span className="font-bold text-[#dc3545]">Peligro:</span>
              <p className="mb-0 text-justify leading-snug text-white/90">
                {PELIGRO[tipoActivo][nivelActivo]}
              </p>
            </div>
            <hr className="my-2 border-t border-white/30" />
            <div className="text-[11px]">
              <span className="font-bold text-[#dc3545]">Recomendación:</span>
              <p className="mb-0 text-justify leading-snug text-white/90">
                {RECOMENDACION[tipoActivo][nivelActivo]}
              </p>
            </div>
            {avisoId && (
              <a
                href={`/avisos/${avisoId}`}
                className="mt-2 block w-full rounded bg-[#00539b] px-3 py-1.5 text-center text-[11px] font-bold text-white transition-colors hover:bg-[#003366]"
              >
                Ver detalle
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-label={legendOpen ? "Ocultar niveles de peligro" : "Mostrar niveles de peligro"}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center self-start rounded-r-[4px] bg-black/60 text-white shadow-sm"
          >
            {legendOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
