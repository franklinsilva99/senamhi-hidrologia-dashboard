import { getStations, getAlerts } from "@/lib/data";
import { getForecastDiario } from "@/lib/queries";

export default function AdminDashboard() {
  const stations = getStations();
  const alerts = getAlerts();
  const vigentes = alerts.filter((a) => a.vigente);
  const forecast = getForecastDiario();
  const modelosActivos = new Set(forecast.map((f) => f.stationId)).size;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Panel de Administración</h1>
      <p className="text-sm text-slate-600">
        Gestión de avisos hidrológicos y carga de pronóstico multi-modelo para la sede de contingencia Junín.
      </p>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500">Estaciones</p>
          <p className="text-2xl font-bold">{stations.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500">Avisos vigentes</p>
          <p className="text-2xl font-bold text-[#fca326]">{vigentes.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500">Estaciones con pronóstico</p>
          <p className="text-2xl font-bold text-[#00539b]">{modelosActivos}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500">Total modelos ingresados</p>
          <p className="text-2xl font-bold">{forecast.length}</p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid sm:grid-cols-2 gap-4">
        <a
          href="/admin/avisos"
          className="block bg-white rounded-xl border p-4 hover:border-[#00539b] transition-colors"
        >
          <h2 className="font-semibold text-[#003366]">Gestionar Avisos</h2>
          <p className="text-sm text-slate-500 mt-1">
            Crear, editar, habilitar/deshabilitar avisos hidrológicos. Tabla estilo PHISIS.
          </p>
        </a>
        <a
          href="/admin/pronostico"
          className="block bg-white rounded-xl border p-4 hover:border-[#00539b] transition-colors"
        >
          <h2 className="font-semibold text-[#003366]">Cargar Pronóstico</h2>
          <p className="text-sm text-slate-500 mt-1">
            Ingresar Modelo 1..4 por estación y fecha. Solo Diario disponible en contingencia.
          </p>
        </a>
      </div>

      {/* Tabla resumen avisos */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <p className="p-3 font-semibold text-sm border-b">Avisos recientes</p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">Nro</th>
              <th className="p-2 text-left">Estación</th>
              <th className="p-2 text-left">Título</th>
              <th className="p-2">Nivel</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={`${a.ca}-${a.ce}`} className="border-t">
                <td className="p-2">{a.nro}</td>
                <td className="p-2">{a.stationId}</td>
                <td className="p-2 text-xs">{a.titulo}</td>
                <td className="p-2 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      a.nivel === "ROJO"
                        ? "bg-[#ee3d43] text-white"
                        : a.nivel === "NARANJA"
                          ? "bg-[#fca326] text-white"
                          : "bg-[#ffeb3b] text-black"
                    }`}
                  >
                    {a.nivel}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <span className={`text-xs ${a.vigente ? "text-green-600 font-semibold" : "text-slate-400"}`}>
                    {a.vigente ? "Vigente" : "Histórico"}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <a href={`/avisos/${a.ca}-${a.ce}`} className="text-[#00539b] underline text-xs">
                    +Info
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
