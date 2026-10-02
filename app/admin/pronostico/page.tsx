"use client";
import { useEffect, useMemo, useState } from "react";
import { getStations, getMockNow } from "@/lib/infra/data";
import { getForecastDiario, appendForecastInputs, getForecastInputs } from "@/lib/infra/catalogos";
import type { ForecastDiario, ForecastInput } from "@/lib/domain/types";
import { USUARIO } from "@/lib/sesion";

const stations = getStations();
const dzList = [...new Set(stations.map((s) => s.dz).filter(Boolean))];

export default function AdminPronosticoPage() {
  const [activeTab, setActiveTab] = useState<"horario" | "diario" | "mensual">("diario");

  const [formDZ, setFormDZ] = useState("");
  const [formStation, setFormStation] = useState("");
  const [saved, setSaved] = useState(false);
  const [modelos, setModelos] = useState<Record<string, Record<number, string>>>({});
  // Inicializado vacío para evitar hydration mismatch (los overlays solo existen en el cliente).
  const [diario, setDiario] = useState<ForecastDiario[]>([]);
  const [inputs, setInputs] = useState<ForecastInput[]>([]);
  const [fechas, setFechas] = useState<string[]>([]);

  useEffect(() => {
    const base = getMockNow().slice(0, 10) || new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setFechas([1, 2, 3].map((i) => {
      const d = new Date(`${base}T00:00`);
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }));
    setDiario(getForecastDiario());
    setInputs(getForecastInputs());
  }, []);

  const usuarioPorKey = useMemo(
    () => new Map(inputs.map((i) => [`${i.stationId}|${i.fecha}`, i.usuario])),
    [inputs]
  );

  const filteredStations = formDZ
    ? stations.filter((s) => s.dz === formDZ)
    : stations;

  const setModelo = (fecha: string, idx: number, valor: string) =>
    setModelos((p) => ({ ...p, [fecha]: { ...p[fecha], [idx]: valor } }));

  const handleSave = () => {
    if (!formStation) return;
    const nuevos: ForecastInput[] = [];
    for (const fecha of fechas) {
      const celdas = modelos[fecha];
      if (!celdas) continue;
      for (let idx = 0; idx < 4; idx++) {
        const raw = celdas[idx];
        if (raw == null || raw.trim() === "") continue;
        const valor = parseFloat(raw);
        if (isNaN(valor)) continue;
        nuevos.push({
          stationId: formStation,
          fecha,
          modelo: `Modelo ${idx + 1}`,
          valor,
          usuario: "operador-DZ",
        });
      }
    }
    if (nuevos.length === 0) return;
    appendForecastInputs(nuevos);
    setDiario(getForecastDiario());
    setInputs(getForecastInputs());
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
              {/* Fila: DZ + Estación */}
              <div className="grid grid-cols-2 gap-4 mb-4 items-end">
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
                        {[0, 1, 2, 3].map((idx) => (
                          <td key={idx} className="p-1 border border-slate-300">
                            <input
                              type="number"
                              step="0.1"
                              value={modelos[f]?.[idx] ?? ""}
                              onChange={(e) => setModelo(f, idx, e.target.value)}
                              className="w-full border-0 p-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                        ))}
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

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#00539b] text-white text-center">
                  <tr>
                    <th className="p-2.5 font-semibold">Dirección Zonal</th>
                    <th className="p-2.5 font-semibold">Estación</th>
                    <th className="p-2.5 font-semibold">Cuerpo Agua</th>
                    <th className="p-2.5 font-semibold">Fecha Pronóstico</th>
                    <th className="p-2.5 font-semibold">Usuario</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {diario.map((fd) => {
                    const st = stations.find((s) => s.id === fd.stationId);
                    const usuario = usuarioPorKey.get(`${fd.stationId}|${fd.fecha}`) ?? USUARIO.usuario;
                    return (
                      <tr key={`${fd.stationId}-${fd.fecha}`} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="p-2 text-xs">{st?.dz ?? "—"}</td>
                        <td className="p-2 font-semibold text-xs">{st?.estacion ?? fd.stationId}</td>
                        <td className="p-2 text-xs">{st?.rio ?? "—"}</td>
                        <td className="p-2 text-xs">{fd.fecha}</td>
                        <td className="p-2 text-xs">{usuario}</td>
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
