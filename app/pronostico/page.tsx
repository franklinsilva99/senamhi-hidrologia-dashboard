import TopicBanner from "@/components/TopicBanner";
import MapPronosticoClient from "@/components/MapPronosticoClient";
import { avisoTabClass } from "@/lib/tabs";
import { getForecastDiario, getStations, getThresholds, getForecastInputs, clasificarUmbral } from "@/lib/queries";
import type { ForecastDiario, ForecastInput } from "@/lib/types";

export default function PronosticoPage() {
  const stations = getStations();
  const diario = getForecastDiario();
  const byStation = (id: string) => diario.filter((f) => f.stationId === id);
  const fechas = Array.from(new Set(diario.map((f) => f.fecha))).sort().slice(0, 6);

  // Estaciones con pronóstico + su serie D+1..3
  const conPronostico = stations.filter((s) => diario.some((f) => f.stationId === s.id));
  const forecastPorEstacion: Record<string, ForecastDiario[]> = {};
  for (const s of conPronostico) forecastPorEstacion[s.id] = byStation(s.id);

  // Nivel pronosticado (interino: día más severo contra umbrales de caudal)
  const thMap = Object.fromEntries(getThresholds().map((t) => [t.stationId, t]));
  const nivelPorEstacion: Record<string, string> = {};
  for (const s of conPronostico) {
    const f = forecastPorEstacion[s.id];
    const th = thMap[s.id];
    if (!f.length || !th) {
      nivelPorEstacion[s.id] = "normal";
      continue;
    }
    const valores = f.map((x) => x.caudalPrevisto);
    const severo = th.tipo === "vigilancia" ? Math.min(...valores) : Math.max(...valores);
    nivelPorEstacion[s.id] = clasificarUmbral(severo, th, "caudal") ?? "normal";
  }

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
          <h2 className="text-center text-lg font-bold text-gray-800 uppercase tracking-tight">
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
            nivelPorEstacion={nivelPorEstacion}
            umbralesPorEstacion={umbralesPorEstacion}
          />
        </section>

        <section className="w-full mb-6">
          <h3 className="text-sm font-bold tracking-wide text-gray-700 uppercase text-center mb-3">
            Diario — 6 días de pronóstico (promedio modelos ingresados)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#0070c0] text-white divide-x divide-blue-400 font-bold">
                  <th className="py-2.5 px-3 uppercase tracking-tight text-left">Estación</th>
                  {fechas.map((f) => (
                    <th key={f} className="py-2.5 px-3 uppercase tracking-tight">Pronóstico {f}</th>
                  ))}
                  <th className="py-2.5 px-3 uppercase tracking-tight">Modelos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800 bg-white">
                {stations.map((s) => {
                  const f = byStation(s.id);
                  return (
                    <tr key={s.id} className="divide-x divide-gray-200 text-xs sm:text-[13px]">
                      <td className="py-2 px-3 text-left">
                        <span className="font-medium">{s.estacion}</span>
                        <br />
                        <span className="text-[11px] text-gray-500">{s.rio} ({s.dz})</span>
                      </td>
                      {fechas.map((fe) => {
                        const x = f.find((y) => y.fecha === fe);
                        return (
                          <td key={fe} className="py-2 px-3">
                            {x ? (
                              <>
                                <span className="font-semibold">{x.caudalPrevisto}</span> m³/s
                                <br />
                                <span className="text-[11px] text-gray-500">promedio {x.nModelos}</span>
                              </>
                            ) : (
                              <span className="text-[11px] text-gray-400">sin datos</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-[11px] text-gray-600">
                        {f.length ? `${f[0].nModelos} modelo(s): ${f[0].modelos.join(", ")}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-gray-500 text-center">
          Cada día de pronóstico es el promedio de los modelos ingresados (ETA32, GFS0.25, PISCO-light). Haga clic en una estación del mapa para ver su hidrograma.
        </p>

        <footer className="flex justify-center pt-4 pb-2">
          <div className="w-16 h-1 bg-[#0070c0] rounded-full" />
        </footer>
      </main>
    </div>
  );
}
