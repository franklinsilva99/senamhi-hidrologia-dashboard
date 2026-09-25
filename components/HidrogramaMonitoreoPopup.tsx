"use client";
import { useMemo, useState } from "react";
import HidrogramaPopupCard from "@/components/HidrogramaPopupCard";
import ChartHydro from "@/components/ChartHydro";
import type { ConfigEstacion } from "@/lib/configEstacion";
import type { Observation, Station } from "@/lib/types";

type Variable = "caudal" | "nivel";

// Promedio diario (para la granularidad "Diario")
function promedioDiario(series: Observation[]): Observation[] {
  const m = new Map<string, { c: number; l: number; count: number; stationId: string }>();
  for (const o of series) {
    const dia = o.fecha.slice(0, 10) + "T00:00";
    const e = m.get(dia) ?? { c: 0, l: 0, count: 0, stationId: o.stationId };
    e.c += o.caudal;
    e.l += o.nivel;
    e.count++;
    m.set(dia, e);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, e]) => ({
      stationId: e.stationId,
      fecha,
      caudal: Math.round((e.c / e.count) * 10) / 10,
      nivel: Math.round((e.l / e.count) * 100) / 100,
      origen: "qc1-ok" as const,
      estado: "normal" as const,
    }));
}

export default function HidrogramaMonitoreoPopup({
  station,
  series,
  config,
  onClose,
}: {
  station: Station;
  series: Observation[];
  config: ConfigEstacion;
  onClose: () => void;
}) {
  const variables: Variable[] = config.variables ?? ["caudal", "nivel"];
  const inicial: Variable = variables.includes(config.preferencia) ? config.preferencia : variables[0];
  const [variable, setVariable] = useState<Variable>(inicial);
  const [granularidad, setGranularidad] = useState<"horario" | "diario">("horario");

  const serieGraficada = useMemo(
    () => (granularidad === "diario" ? promedioDiario(series) : series),
    [series, granularidad],
  );

  const u = variable === "caudal" ? config.caudal : config.nivel;
  const variableTitle = variable === "caudal" ? "Caudal" : "Nivel";
  const hoyISO = new Date().toISOString().slice(0, 10);

  const controles = (
    <>
      {/* Radio Nivel / Caudal */}
      <div className="flex items-center gap-3">
        {(["nivel", "caudal"] as Variable[]).map((v) => {
          const disponible = variables.includes(v);
          return (
            <label
              key={v}
              className={`inline-flex items-center gap-1.5 ${disponible ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
            >
              <input
                type="radio"
                name={`var-${station.id}`}
                checked={variable === v}
                disabled={!disponible}
                onChange={() => setVariable(v)}
                className="accent-[#0070ba]"
              />
              <span className={variable === v ? "font-semibold text-gray-800" : "text-gray-600"}>
                {v === "nivel" ? "Nivel" : "Caudal"}
              </span>
            </label>
          );
        })}
      </div>
      {/* Toggle Horario / Diario */}
      <div className="inline-flex items-center overflow-hidden rounded border border-gray-300">
        {(["horario", "diario"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGranularidad(g)}
            className={`px-3 py-0.5 text-[11px] ${
              granularidad === g ? "bg-[#0070ba] font-semibold text-white" : "bg-white text-gray-700 border-l border-gray-200"
            }`}
          >
            {g === "horario" ? "Horario" : "Diario"}
          </button>
        ))}
      </div>
    </>
  );

  const legend = (
    <>
      <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: "#0000ff" }} /> Datos Horarios</span>
      <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: "#ee3d43" }} /> Rojo</span>
      <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: "#fca326" }} /> Naranja</span>
      <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: "#ffeb3b" }} /> Amarillo</span>
    </>
  );

  return (
    <HidrogramaPopupCard
      titulo={`Hidrograma de ${variableTitle} del Río ${station.rio.toUpperCase()}`}
      subtitulo={`Estación ${station.estacion.toUpperCase()}`}
      fecha={hoyISO}
      filename={`hidrograma-${station.rio.toLowerCase()}-${station.id}`}
      onClose={onClose}
      controles={controles}
      legend={legend}
      chartHeightClass=""
      chartFullscreenClass=""
    >
      <ChartHydro
        series={serieGraficada}
        preferencia={variable}
        tipo={config.tipo}
        cota={config.cota}
        umbralAmarilla={u.amarilla}
        umbralNaranja={u.naranja}
        umbralRoja={u.roja}
        navigator
      />
    </HidrogramaPopupCard>
  );
}
