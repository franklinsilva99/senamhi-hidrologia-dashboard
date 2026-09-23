import MapClient from "@/components/MapClient";
import { getAlerts, getLatestByStation, getStations } from "@/lib/data";
import StationTable from "@/components/StationTable";
import ModelStatus from "@/components/ModelStatus";

export default function Home() {
  const stations = getStations();
  const latest = getLatestByStation();
  const alerts = getAlerts();
  const vigentes = alerts.filter((a) => a.vigente);
  const rojas = vigentes.filter((a) => a.nivel === "ROJO").length;

  return (
    <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-slate-500">Estaciones piloto</p><p className="text-2xl font-bold">{stations.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-slate-500">Avisos vigentes</p><p className="text-2xl font-bold">{vigentes.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-slate-500">Nivel rojo</p><p className="text-2xl font-bold text-[#ee3d43]">{rojas}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-slate-500">Pronóstico</p><p className="text-sm font-bold">Promedio 1..N modelos</p></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MapClient stations={stations} latest={latest} />
          <p className="text-xs text-slate-500 mt-1">4 estaciones reales (Socsi, Chosica, Pisac, Puente Ramis). Verde/amarillo/naranja/rojo = estado por umbral QC1.</p>
        </div>
        <ModelStatus />
      </div>

      <StationTable stations={stations} latest={latest} />
    </main>
  );
}
