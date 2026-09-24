import SectionHeader from "@/components/SectionHeader";
import { getForecastDiario, getStations } from "@/lib/queries";

export default function PronosticoPage() {
  const stations = getStations();
  const diario = getForecastDiario();
  const byStation = (id: string) => diario.filter((f) => f.stationId === id);
  const fechas = Array.from(new Set(diario.map((f) => f.fecha))).sort();

  return (
    <div className="min-h-screen bg-senamhi-bg">
      <SectionHeader title="Hidrología / Pronóstico Hidrológico" />

      <main className="w-full max-w-5xl bg-white shadow-sm my-4 md:my-6 p-4 sm:p-8 md:p-10 border border-gray-200 mx-auto">
        <h2 className="text-red-600 font-extrabold text-2xl md:text-[28px] leading-tight tracking-normal uppercase text-center mb-4">
          Pronóstico hidrológico — Diario (promedio de modelos)
        </h2>

        <p className="text-sm text-gray-700 text-justify max-w-4xl mx-auto mb-6">
          Regla: <b>0 modelos → no se publica</b> · <b>1 modelo → se muestra ese valor</b> · <b>2+ → promedio aritmético simple</b>.
          Solo Diario D+1..3. Mensual y Horario no disponibles en contingencia.
        </p>

        <section className="w-full max-w-4xl mx-auto mb-6 border border-gray-100 p-2 sm:p-4 rounded">
          <h3 className="text-sm font-bold tracking-wide text-gray-700 uppercase text-center mb-3">
            Diario — 3 días (promedio modelos ingresados)
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
          Ejemplo: Socsi promedia 3 modelos, Chosica 1 modelo (valor directo), Pisac 4, Puente Ramis 0 (no se publica).
        </p>

        <footer className="flex justify-center pt-4 pb-2">
          <div className="w-16 h-1 bg-[#0070c0] rounded-full" />
        </footer>
      </main>
    </div>
  );
}
