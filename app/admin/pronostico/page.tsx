"use client";
import { useState } from "react";
import { getStations } from "@/lib/data";
import { getForecastInputs, getForecastDiario } from "@/lib/queries";
import type { ForecastInput, ForecastDiario } from "@/lib/types";

const stations = getStations();
const dzList = [...new Set(stations.map((s) => s.dz).filter(Boolean))];

export default function AdminPronosticoPage() {
  const [activeTab, setActiveTab] = useState<"horario" | "diario" | "mensual">("diario");
  const [filtroStation, setFiltroStation] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

  const [formDZ, setFormDZ] = useState("");
  const [formStation, setFormStation] = useState("");
  const [formFecha, setFormFecha] = useState("");
  const [modelo1, setModelo1] = useState("");
  const [modelo2, setModelo2] = useState("");
  const [modelo3, setModelo3] = useState("");
  const [modelo4, setModelo4] = useState("");
  const [saved, setSaved] = useState(false);

  const inputs = getForecastInputs();
  const diario = getForecastDiario();

  const filteredStations = formDZ
    ? stations.filter((s) => s.dz === formDZ)
    : stations;

  const filteredInputs = inputs.filter((fi) => {
    if (filtroStation && fi.stationId !== filtroStation) return false;
    if (filtroFecha && fi.fecha !== filtroFecha) return false;
    return true;
  });

  const filteredDiario = diario.filter((fd) => {
    if (filtroStation && fd.stationId !== filtroStation) return false;
    if (filtroFecha && fd.fecha !== filtroFecha) return false;
    return true;
  });

  // Fechas D+1, D+2, D+3
  const hoy = new Date();
  const fechas = [0, 1, 2].map((i) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Tabs pills azules */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("horario")}
          className="px-5 py-2 rounded text-sm font-bold uppercase bg-[#00539b] text-white hover:bg-[#0070ba] opacity-60 cursor-not-allowed"
          disabled
        >
          Pronóstico - Horario
        </button>
        <button
          onClick={() => setActiveTab("diario")}
          className={`px-5 py-2 rounded text-sm font-bold uppercase ${
            activeTab === "diario"
              ? "bg-[#00539b] text-white"
              : "bg-[#00539b] text-white opacity-70 hover:bg-[#0070ba]"
          }`}
        >
          Pronóstico - Diario
        </button>
        <button
          onClick={() => setActiveTab("mensual")}
          className="px-5 py-2 rounded text-sm font-bold uppercase bg-[#00539b] text-white hover:bg-[#0070ba] opacity-60 cursor-not-allowed"
          disabled
        >
          Pronóstico - Mensual
        </button>
      </div>

      {activeTab === "diario" && (
        <div className="space-y-5">
          {/* Formulario de carga */}
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="bg-[#00539b] text-white px-4 py-2 rounded-t-lg">
              <h2 className="text-sm font-bold uppercase">Registro de Datos de Pronóstico</h2>
            </div>
            <div className="p-4">
              {/* Fila: DZ + Estación + Fecha + botón + */}
              <div className="grid grid-cols-4 gap-4 mb-4 items-end">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 uppercase">Dirección Zonal</label>
                  <select
                    value={formDZ}
                    onChange={(e) => {
                      setFormDZ(e.target.value);
                      setFormStation("");
                    }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">Seleccione</option>
                    {dzList.map((dz) => (
                      <option key={dz} value={dz!}>{dz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 uppercase">Estación</label>
                  <select
                    value={formStation}
                    onChange={(e) => setFormStation(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">Seleccione</option>
                    {filteredStations.map((s) => (
                      <option key={s.id} value={s.id}>{s.estacion}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 uppercase">Fecha</label>
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button className="w-10 h-10 rounded bg-green-500 text-white text-xl font-bold hover:bg-green-600 flex items-center justify-center">
                    +
                  </button>
                </div>
              </div>

              {/* Tabla editable de modelos */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 border border-slate-300 text-left">Fecha</th>
                      <th className="p-2 border border-slate-300 text-center">Modelo 1</th>
                      <th className="p-2 border border-slate-300 text-center">Modelo 2</th>
                      <th className="p-2 border border-slate-300 text-center">Modelo 3</th>
                      <th className="p-2 border border-slate-300 text-center">Modelo 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fechas.map((f) => (
                      <tr key={f}>
                        <td className="p-2 border border-slate-300 font-semibold">{f}</td>
                        <td className="p-1 border border-slate-300">
                          <input type="number" step="0.1" className="w-full border-0 p-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                        <td className="p-1 border border-slate-300">
                          <input type="number" step="0.1" className="w-full border-0 p-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                        <td className="p-1 border border-slate-300">
                          <input type="number" step="0.1" className="w-full border-0 p-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                        <td className="p-1 border border-slate-300">
                          <input type="number" step="0.1" className="w-full border-0 p-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleSave}
                  className="bg-[#00539b] text-white px-8 py-2 rounded text-sm font-semibold hover:bg-[#0070ba]"
                >
                  Guardar
                </button>
              </div>
              {saved && (
                <p className="text-sm text-green-600 font-semibold text-center mt-3">
                  ✓ Modelos guardados correctamente.
                </p>
              )}
            </div>
          </div>

          {/* Listado de pronósticos */}
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="bg-[#00539b] text-white px-4 py-2 rounded-t-lg">
              <h2 className="text-sm font-bold uppercase">Listado de Datos de Pronóstico</h2>
            </div>

            {/* Barra de búsqueda y paginación */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Mostrar:</span>
                <select className="border border-slate-300 rounded px-2 py-1 text-sm">
                  <option>5</option>
                  <option>10</option>
                  <option>25</option>
                </select>
                <span className="text-sm text-slate-500">registros</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Buscar:</span>
                <input
                  type="text"
                  placeholder=""
                  className="border border-slate-300 rounded px-3 py-1 text-sm w-48"
                />
              </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#00539b] text-white text-center">
                  <tr>
                    <th className="p-2.5 font-semibold">Dirección Zonal</th>
                    <th className="p-2.5 font-semibold">Estación</th>
                    <th className="p-2.5 font-semibold">Cuerpo Agua</th>
                    <th className="p-2.5 font-semibold">Sector</th>
                    <th className="p-2.5 font-semibold">Fecha Pronóstico</th>
                    <th className="p-2.5 font-semibold">Usuario</th>
                    <th className="p-2.5 font-semibold" colSpan={2}>Acciones</th>
                  </tr>
                  <tr className="bg-[#0070ba]">
                    <th colSpan={6}></th>
                    <th className="p-1.5 font-normal text-xs">Mas Información</th>
                    <th className="p-1.5 font-normal text-xs">Actualizar Datos</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {filteredDiario.map((fd, i) => {
                    const st = stations.find((s) => s.id === fd.stationId);
                    return (
                      <tr key={i} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="p-2 text-xs">{st?.dz ?? "—"}</td>
                        <td className="p-2 font-semibold text-xs">{st?.estacion ?? fd.stationId}</td>
                        <td className="p-2 text-xs">{st?.rio ?? "—"}</td>
                        <td className="p-2 text-xs">SUR</td>
                        <td className="p-2 text-xs">{fd.fecha}</td>
                        <td className="p-2 text-xs">MCASAVERDE - {st?.dz ?? "DZ"}</td>
                        <td className="p-2">
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded bg-[#00539b] text-white hover:bg-[#0070ba]"
                            title="Mas Información"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </td>
                        <td className="p-2">
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                            title="Actualizar Datos"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab !== "diario" && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-500">
            Módulo de pronóstico {activeTab} no disponible en contingencia.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Solo el pronóstico Diario D+1..3 está habilitado en sede alterna Junín.
          </p>
        </div>
      )}
    </div>
  );
}
