"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { getStations, getMockNow, getCaudalPromedioDiario } from "@/lib/infra/data";
import { getForecastDiario, appendForecastInputs, getForecastInputs } from "@/lib/infra/catalogos";
import { getConfigVigente } from "@/lib/infra/configRecords";
import HidrogramaPronosticoPopup from "@/components/HidrogramaPronosticoPopup";
import type { ForecastDiario, ForecastInput } from "@/lib/domain/types";
import { USUARIO } from "@/lib/sesion";

const stations = getStations();
const dzList = [...new Set(stations.map((s) => s.dz).filter(Boolean))];

// Reloj del mock (dato estático) y "día uno" (primer día pronosticado).
const BASE = getMockNow().slice(0, 10) || new Date().toISOString().slice(0, 10);
const ANCHOR = sumarDias(BASE, 1);

const MODELOS = ["Modelo 1", "Modelo 2", "Modelo 3", "Modelo 4"];

// Suma/resta días a una fecha YYYY-MM-DD (devuelve el mismo formato).
function sumarDias(base: string, dias: number): string {
  const d = new Date(`${base}T00:00`);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Diferencia en días entre dos fechas YYYY-MM-DD (b - a).
function diasEntre(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00`).getTime() - new Date(`${a}T00:00`).getTime()) / 86400000,
  );
}

// Grupo de 3 días consecutivos. El "padre" es el primer día pronosticado.
function grupoDesde(primerDia: string): { padre: string; fechas: string[] } {
  return {
    padre: primerDia,
    fechas: [0, 1, 2].map((i) => sumarDias(primerDia, i)),
  };
}

// Grupo de 3 días que contiene la fecha dada (ajusta al bloque anclado a ANCHOR).
function grupoContiene(fecha: string): { padre: string; fechas: string[] } {
  const k = Math.floor(diasEntre(ANCHOR, fecha) / 3);
  return grupoDesde(sumarDias(ANCHOR, k * 3));
}

export default function AdminPronosticoPage() {
  const [activeTab, setActiveTab] = useState<"horario" | "diario" | "mensual">("diario");

  const [formDZ, setFormDZ] = useState("");
  const [formStation, setFormStation] = useState("");
  const [saved, setSaved] = useState(false);
  const [modelos, setModelos] = useState<Record<string, Record<number, string>>>({});
  // Inicializado vacío para evitar hydration mismatch (los overlays solo existen en el cliente).
  const [diario, setDiario] = useState<ForecastDiario[]>([]);
  const [inputs, setInputs] = useState<ForecastInput[]>([]);
  const [fecha, setFecha] = useState<string>(ANCHOR);
  const [extraGrupos, setExtraGrupos] = useState(0);
  const [editing, setEditing] = useState<{ stationId: string; padre: string; fechas: string[] } | null>(null);
  const [editModelos, setEditModelos] = useState<Record<string, Record<number, string>>>({});
  const [verStationId, setVerStationId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setDiario(getForecastDiario());
    setInputs(getForecastInputs());
  }, []);

  // Grupos mostrados: el bloque que contiene `fecha` + los grupos extra agregados con "+".
  const grupos = useMemo(() => {
    const list = [grupoContiene(fecha)];
    for (let i = 0; i < extraGrupos; i++) {
      const ultimo = list[list.length - 1];
      list.push(grupoDesde(sumarDias(ultimo.fechas[ultimo.fechas.length - 1], 1)));
    }
    return list;
  }, [fecha, extraGrupos]);

  const usuarioPorKey = useMemo(
    () => new Map(inputs.map((i) => [`${i.stationId}|${i.fecha}`, i.usuario])),
    [inputs]
  );

  // Padre por (estación|fecha), para agrupar el listado.
  const padrePorKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of inputs) {
      if (i.padre) m.set(`${i.stationId}|${i.fecha}`, i.padre);
    }
    return m;
  }, [inputs]);

  // Listado agrupado: una fila por (estación, padre), con las fechas del grupo.
  const listadoAgrupado = useMemo(() => {
    const m = new Map<string, { stationId: string; padre: string; fechas: string[] }>();
    for (const fd of diario) {
      const padre = padrePorKey.get(`${fd.stationId}|${fd.fecha}`) ?? fd.fecha;
      const key = `${fd.stationId}|${padre}`;
      if (!m.has(key)) m.set(key, { stationId: fd.stationId, padre, fechas: [] });
      m.get(key)!.fechas.push(fd.fecha);
    }
    const out = [...m.values()];
    out.sort((a, b) => a.padre.localeCompare(b.padre) || a.stationId.localeCompare(b.stationId));
    for (const g of out) g.fechas.sort();
    return out;
  }, [diario, padrePorKey]);

  // Listado filtrado por el texto del buscador (sin distinguir mayúsculas).
  const listadoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return listadoAgrupado;
    return listadoAgrupado.filter((g) => {
      const st = stations.find((s) => s.id === g.stationId);
      const campos = [st?.estacion, st?.rio, st?.dz, g.padre].filter(Boolean).join(" ");
      return campos.toLowerCase().includes(q);
    });
  }, [listadoAgrupado, busqueda]);

  // Valores guardados por (estación|fecha|modelo) para precargar las celdas.
  const guardadoPorCelda = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of inputs) {
      m.set(`${i.stationId}|${i.fecha}|${i.modelo}`, String(i.valor));
    }
    return m;
  }, [inputs]);

  // Fechas que ya tienen al menos un valor guardado para la estación seleccionada.
  const fechasPronosticadas = useMemo(() => {
    const s = new Set<string>();
    for (const i of inputs) {
      if (i.stationId === formStation) s.add(i.fecha);
    }
    return s;
  }, [inputs, formStation]);

  const filteredStations = formDZ
    ? stations.filter((s) => s.dz === formDZ)
    : stations;

  const setModelo = (fecha: string, idx: number, valor: string) =>
    setModelos((p) => ({ ...p, [fecha]: { ...p[fecha], [idx]: valor } }));

  // Valor de una celda: lo escrito por el operador tiene prioridad; si no, lo guardado.
  const valorCelda = (f: string, idx: number): string => {
    const escrito = modelos[f]?.[idx];
    if (escrito != null) return escrito;
    return guardadoPorCelda.get(`${formStation}|${f}|${MODELOS[idx]}`) ?? "";
  };

  // Agrega un grupo consecutivo de 3 días (padre = último día del último grupo + 1).
  const agregarGrupo = () => setExtraGrupos((n) => n + 1);

  // Quita el último grupo agregado (nunca baja de 0, el grupo de la fecha siempre queda).
  const quitarGrupo = () => setExtraGrupos((n) => Math.max(0, n - 1));

  // Abre el modal de edición con los modelos guardados de todo el grupo (3 días).
  const abrirEditar = (stationId: string, padre: string) => {
    const fechas = grupoDesde(padre).fechas;
    const valores: Record<string, Record<number, string>> = {};
    for (const f of fechas) {
      valores[f] = {};
      for (const i of inputs) {
        if (i.stationId !== stationId || i.fecha !== f) continue;
        const idx = MODELOS.indexOf(i.modelo);
        if (idx >= 0) valores[f][idx] = String(i.valor);
      }
    }
    setEditModelos(valores);
    setEditing({ stationId, padre, fechas });
  };

  // Guarda la edición sobrescribiendo los modelos de los días del grupo.
  const guardarEdicion = () => {
    if (!editing) return;
    const nuevos: ForecastInput[] = [];
    for (const f of editing.fechas) {
      const celdas = editModelos[f];
      if (!celdas) continue;
      for (let idx = 0; idx < 4; idx++) {
        const raw = celdas[idx];
        if (raw == null || raw.trim() === "") continue;
        const valor = parseFloat(raw);
        if (isNaN(valor)) continue;
        nuevos.push({
          stationId: editing.stationId,
          fecha: f,
          modelo: MODELOS[idx],
          valor,
          usuario: "operador-DZ",
          padre: editing.padre,
        });
      }
    }
    if (nuevos.length > 0) appendForecastInputs(nuevos);
    setDiario(getForecastDiario());
    setInputs(getForecastInputs());
    setEditing(null);
  };

  const handleSave = () => {
    if (!formStation) return;
    const nuevos: ForecastInput[] = [];
    for (const g of grupos) {
      for (const fecha of g.fechas) {
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
            padre: g.padre,
          });
        }
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
              {/* Fila: DZ + Estación + Fecha + agregar grupo */}
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-4 mb-4 items-end">
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
                    onChange={(e) => {
                      setFormStation(e.target.value);
                      setModelos({});
                    }}
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
                    value={fecha}
                    onChange={(e) => {
                      setFecha(e.target.value || ANCHOR);
                      setExtraGrupos(0);
                    }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end h-full gap-2">
                  <button
                    type="button"
                    onClick={quitarGrupo}
                    disabled={extraGrupos === 0}
                    title="Quitar 3 días"
                    aria-label="Quitar 3 días"
                    className="w-9 h-9 rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm flex items-center justify-center transition hover:bg-slate-100 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070ba] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:scale-100"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={agregarGrupo}
                    title="Agregar 3 días"
                    aria-label="Agregar 3 días"
                    className="w-9 h-9 rounded-full bg-[#00539b] text-white shadow-sm flex items-center justify-center transition hover:bg-[#0070ba] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070ba] focus-visible:ring-offset-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
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
                    {grupos.map((g) => (
                      <Fragment key={g.padre}>
                        <tr className="bg-blue-50">
                          <td colSpan={5} className="p-2 border border-slate-300 text-left font-semibold text-xs uppercase text-slate-600">
                            Fecha Pronóstico: {g.padre}
                          </td>
                        </tr>
                        {g.fechas.map((f) => {
                          const pronosticada = fechasPronosticadas.has(f);
                          return (
                            <tr key={f} className={pronosticada ? "bg-slate-50" : undefined}>
                              <td className="p-2 border border-slate-300 font-semibold">
                                {f}
                                {pronosticada && (
                                  <span className="ml-1 text-[10px] font-normal text-slate-400">(pronosticado)</span>
                                )}
                              </td>
                              {[0, 1, 2, 3].map((idx) => {
                                const guardado = guardadoPorCelda.get(`${formStation}|${f}|${MODELOS[idx]}`) ?? "";
                                return (
                                  <td key={idx} className="p-1 border border-slate-300">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={pronosticada ? guardado : valorCelda(f, idx)}
                                      onChange={(e) => setModelo(f, idx, e.target.value)}
                                      disabled={pronosticada}
                                      className="w-full border-0 p-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </Fragment>
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
            <div className="bg-[#00539b] text-white px-4 py-2 rounded-t-lg flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold uppercase">Listado de Datos de Pronóstico</h2>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                className="w-44 sm:w-56 rounded px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-white"
              />
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
                    <th className="p-2.5 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {listadoFiltrado.map((g) => {
                    const st = stations.find((s) => s.id === g.stationId);
                    const usuario = usuarioPorKey.get(`${g.stationId}|${g.fechas[0]}`) ?? USUARIO.usuario;
                    return (
                      <tr key={`${g.stationId}-${g.padre}`} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="p-2 text-xs">{st?.dz ?? "—"}</td>
                        <td className="p-2 font-semibold text-xs">{st?.estacion ?? g.stationId}</td>
                        <td className="p-2 text-xs">{st?.rio ?? "—"}</td>
                        <td className="p-2 text-xs">{g.padre}</td>
                        <td className="p-2 text-xs">{usuario}</td>
                        <td className="p-2 whitespace-nowrap">
                          <button
                            onClick={() => abrirEditar(g.stationId, g.padre)}
                            className="text-xs font-semibold text-[#00539b] hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setVerStationId(g.stationId)}
                            className="ml-3 text-xs font-semibold text-[#00539b] hover:underline"
                          >
                            Ver hidrograma
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
            Solo el pronóstico Diario por grupos de 3 días está habilitado en sede alterna Junín.
          </p>
        </div>
      )}

      {/* Modal de edición de pronóstico */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5">
            <h3 className="text-sm font-bold uppercase text-slate-700 mb-1">Editar pronóstico</h3>
            <p className="text-xs text-slate-500 mb-3">
              {stations.find((s) => s.id === editing.stationId)?.estacion ?? editing.stationId} — Padre: {editing.padre}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-xs text-slate-600">
                    <th className="p-2 border border-slate-200 text-left">Fecha</th>
                    {MODELOS.map((m) => (
                      <th key={m} className="p-2 border border-slate-200 text-center font-normal">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editing.fechas.map((f) => (
                    <tr key={f}>
                      <td className="p-2 border border-slate-200 font-semibold text-xs">{f}</td>
                      {[0, 1, 2, 3].map((idx) => (
                        <td key={idx} className="p-1 border border-slate-200">
                          <input
                            type="number"
                            step="0.1"
                            value={editModelos[f]?.[idx] ?? ""}
                            onChange={(e) =>
                              setEditModelos((p) => ({ ...p, [f]: { ...p[f], [idx]: e.target.value } }))
                            }
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                className="px-4 py-2 rounded text-sm font-semibold bg-[#00539b] text-white hover:bg-[#0070ba]"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ver hidrograma del pronóstico */}
      {verStationId && (() => {
        const st = stations.find((s) => s.id === verStationId);
        if (!st) return null;
        const record = getConfigVigente(st.id, st.preferencia ?? "caudal", getMockNow());
        const u = record?.umbrales[st.tipo ?? "avenida"];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-auto">
            <HidrogramaPronosticoPopup
              station={st}
              umbrales={u ?? { amarilla: 0, naranja: 0, roja: 0 }}
              forecast={diario.filter((f) => f.stationId === verStationId)}
              inputs={inputs.filter((i) => i.stationId === verStationId)}
              caudalPromedio={getCaudalPromedioDiario(verStationId)}
              onClose={() => setVerStationId(null)}
            />
          </div>
        );
      })()}
    </div>
  );
}
