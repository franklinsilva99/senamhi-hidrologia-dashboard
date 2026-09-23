import { getForecastDiario, getStations } from "@/lib/queries";

export default function PronosticoPage() {
  const stations = getStations();
  const diario = getForecastDiario();
  const byStation = (id: string) => diario.filter((f) => f.stationId === id);
  const fechas = Array.from(new Set(diario.map((f) => f.fecha))).sort();

  return (
    <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      <p className="text-sm text-slate-500">Hidrología / Pronóstico Hidrológico</p>
      <h1 className="text-xl font-bold">Pronóstico hidrológico — Diario (promedio de modelos)</h1>
      <p className="text-sm text-slate-600">
        Regla: <b>0 modelos → no se publica</b> · <b>1 modelo → se muestra ese valor</b> · <b>2+ → promedio aritmético simple</b>.
        Solo Diario D+1..3. Mensual y Horario no disponibles en contingencia.
      </p>

      <section className="bg-white rounded-xl border p-3">
        <h2 className="font-semibold mb-2">Diario — 3 días (promedio modelos ingresados)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">Estación</th>
                {fechas.map((f) => <th key={f} className="p-2">Pronóstico {f}</th>)}
                <th className="p-2">Modelos</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => {
                const f = byStation(s.id);
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2"><b>{s.estacion}</b><br /><span className="text-xs">{s.rio} ({s.dz})</span></td>
                    {fechas.map((fe) => {
                      const x = f.find((y) => y.fecha === fe);
                      return (
                        <td key={fe} className="p-2 text-center">
                          {x ? (
                            <>
                              <b>{x.caudalPrevisto}</b> m³/s
                              <br /><span className="text-xs">promedio {x.nModelos}</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">sin datos</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-xs">
                      {f.length ? `${f[0].nModelos} modelo(s): ${f[0].modelos.join(", ")}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Ejemplo: Socsi promedia 3 modelos, Chosica 1 modelo (valor directo), Pisac 4, Puente Ramis 0 (no se publica).
      </p>
    </main>
  );
}
