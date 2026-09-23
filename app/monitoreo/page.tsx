"use client";
import { useState, useEffect } from "react";
import { getSeriesMerged, getStations, getLatestMerged } from "@/lib/data";
import { getThresholds } from "@/lib/queries";
import ChartHydro from "@/components/ChartHydro";
import MapClient from "@/components/MapClient";
import StationTable from "@/components/StationTable";
import type { Observation } from "@/lib/types";

function cargarSeries(): Record<string, Observation[]> {
  const m: Record<string, Observation[]> = {};
  for (const s of getStations()) m[s.id] = getSeriesMerged(s.id);
  return m;
}

export default function MonitoreoPage() {
  const stations = getStations();
  const thresholds = getThresholds();
  const thMap = Object.fromEntries(thresholds.map((t) => [t.stationId, t]));

  const [latest, setLatest] = useState<Record<string, Observation>>(() => getLatestMerged());
  const [series, setSeries] = useState<Record<string, Observation[]>>(cargarSeries);

  useEffect(() => {
    setLatest(getLatestMerged());
    setSeries(cargarSeries());
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      <p className="text-sm text-slate-500">Hidrología / Monitoreo Hidrológico</p>
      <h1 className="text-xl font-bold">Monitoreo hidrológico — piloto 4 estaciones (QC1 → público)</h1>
      <p className="text-sm text-slate-600">
        Caudales horarios 72h con control de calidad nivel 1 (mín/máx) aplicado en sede alterna. Origen
        <span className="font-mono"> qc1-ok</span> / <span className="font-mono">cuarentena</span> (fuera de rango).
      </p>
      <MapClient stations={stations} latest={latest} />
      <StationTable stations={stations} latest={latest} />
      <h2 className="font-semibold">Serie horaria 72h + umbrales (Recharts)</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {stations.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border p-3">
            <p className="font-semibold text-sm">{s.rio} — {s.estacion} <span className="text-xs font-normal">({s.dz ?? "central"})</span></p>
            <p className="text-xs text-slate-500">
              Último: Q {latest[s.id]?.caudal} m³/s · N {latest[s.id]?.nivel} m
              {s.cota != null && latest[s.id] ? ` (${(latest[s.id].nivel + s.cota).toFixed(2)} m.s.n.m.)` : ""} ·{" "}
              {latest[s.id]?.estado} · QC1 {latest[s.id]?.origen}
            </p>
            <ChartHydro
              series={series[s.id] ?? []}
              preferencia={thMap[s.id]?.preferencia ?? "caudal"}
              tipo={thMap[s.id]?.tipo ?? "avenida"}
              cota={s.cota}
              umbralAmarilla={thMap[s.id]?.preferencia === "nivel" ? thMap[s.id]?.nivel.amarilla : thMap[s.id]?.caudal.amarilla}
              umbralNaranja={thMap[s.id]?.preferencia === "nivel" ? thMap[s.id]?.nivel.naranja : thMap[s.id]?.caudal.naranja}
              umbralRoja={thMap[s.id]?.preferencia === "nivel" ? thMap[s.id]?.nivel.roja : thMap[s.id]?.caudal.roja}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
