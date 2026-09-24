import TopicBanner from "@/components/TopicBanner";
import MapPronosticoClient from "@/components/MapPronosticoClient";
import { avisoTabClass } from "@/lib/tabs";
import { getForecastDiario, getStations, getThresholds, getForecastInputs } from "@/lib/queries";
import type { ForecastDiario, ForecastInput } from "@/lib/types";

export default function PronosticoPage() {
  const stations = getStations();
  const diario = getForecastDiario();
  const byStation = (id: string) => diario.filter((f) => f.stationId === id);

  // Estaciones con pronóstico + su serie
  const conPronostico = stations.filter((s) => diario.some((f) => f.stationId === s.id));
  const forecastPorEstacion: Record<string, ForecastDiario[]> = {};
  for (const s of conPronostico) forecastPorEstacion[s.id] = byStation(s.id);

  const thMap = Object.fromEntries(getThresholds().map((t) => [t.stationId, t]));

  // Inputs (modelos) por estación → Min–Max del popup
  const inputs = getForecastInputs();
  const inputsPorEstacion: Record<string, ForecastInput[]> = {};
  for (const s of conPronostico) inputsPorEstacion[s.id] = inputs.filter((i) => i.stationId === s.id);

  // Umbrales según preferencia de la estación (caudal o nivel)
  const umbralesPorEstacion: Record<string, { amarilla: number; naranja: number; roja: number }> = {};
  for (const s of conPronostico) {
    const th = thMap[s.id];
    if (!th) continue;
    const u = th.preferencia === "nivel" ? th.nivel : th.caudal;
    umbralesPorEstacion[s.id] = { amarilla: u.amarilla, naranja: u.naranja, roja: u.roja };
  }

  return (
    <div className="min-h-screen bg-white">
      <TopicBanner
        subtitle="Sistema de Pronóstico Hidrológico"
        title="Hidrología / Pronóstico Hidrológico"
        description="Pronóstico hidrológico diario (D+1 a D+3) como promedio de los modelos ingresados por las direcciones zonales, para los principales ríos y cuencas del país."
      />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav aria-label="Pestañas de pronóstico" className="border-b border-gray-300 mb-6">
          <ul className="flex space-x-1 text-sm">
            <li><a className={avisoTabClass(true)}>Diario</a></li>
            <li><span className={`${avisoTabClass(false)} pointer-events-none opacity-50 cursor-not-allowed`} title="No disponible en contingencia">Mensual</span></li>
            <li><span className={`${avisoTabClass(false)} pointer-events-none opacity-50 cursor-not-allowed`} title="No disponible en contingencia">Horario</span></li>
          </ul>
        </nav>

        <section className="w-full mb-6">
          <h2 className="text-justify text-lg font-bold text-gray-800 uppercase tracking-tight">
            Pronóstico Hidrológico a nivel nacional
          </h2>
          <p className="text-justify text-sm text-gray-700 mt-2 mb-4">
            Pronóstico diario de caudales en cuencas con modelos hidrológicos implementados,
            considerando las previsiones de lluvia con horizonte de 3 días.
          </p>
          
          <MapPronosticoClient
            stations={conPronostico}
            forecastPorEstacion={forecastPorEstacion}
            inputsPorEstacion={inputsPorEstacion}
            umbralesPorEstacion={umbralesPorEstacion}
          />
        </section>

        <footer className="flex justify-center pt-4 pb-2">
          <div className="w-16 h-1 bg-[#0070c0] rounded-full" />
        </footer>
      </main>
    </div>
  );
}
