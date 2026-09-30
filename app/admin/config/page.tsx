"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getStationsConfig,
  setStationConfig,
} from "@/lib/infra/stationConfig";
import {
  getConfigRecords,
  setConfigRecord,
} from "@/lib/infra/configRecords";
import { UNIDAD_POR_VARIABLE } from "@/lib/domain/types";
import type { ConfigRecord, Station, Variable } from "@/lib/domain/types";

const inputNum =
  "w-16 rounded border border-slate-300 px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400";
const inputSel =
  "w-full rounded border border-slate-300 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400";

// Orden válido de umbrales: avenida ascendente, vigilancia descendente.
function ordenValido(
  u: { amarilla: number; naranja: number; roja: number } | undefined,
  tipo: "avenida" | "vigilancia"
): boolean {
  if (!u) return true;
  if (tipo === "vigilancia") return u.amarilla >= u.naranja && u.naranja >= u.roja;
  return u.amarilla <= u.naranja && u.naranja <= u.roja;
}

// Actualiza un campo del set de umbrales, completando los faltantes con 0.
function setCampo(
  u: { amarilla: number; naranja: number; roja: number } | undefined,
  campo: "amarilla" | "naranja" | "roja",
  valor: number
): { amarilla: number; naranja: number; roja: number } {
  return {
    amarilla: campo === "amarilla" ? valor : u?.amarilla ?? 0,
    naranja: campo === "naranja" ? valor : u?.naranja ?? 0,
    roja: campo === "roja" ? valor : u?.roja ?? 0,
  };
}

const PREF_LABEL: Record<string, string> = { caudal: "Caudal", nivel: "Nivel" };
const TIPO_LABEL: Record<string, string> = { avenida: "Avenida", vigilancia: "Vigilancia" };
const PUB_LABEL: Record<string, string> = { automatico: "Automática", manual: "Manual" };
const ESTADO_LABEL: Record<string, string> = { activa: "Activa", mantenimiento: "Mantenimiento" };
const COTA_LABEL: Record<string, string> = {
  oficial: "Oficial (DZ)",
  "inventario-altitud": "Inventario (altitud)",
  dem: "DEM",
};

// Celda numérica: input en modo edición, valor como texto en solo lectura.
function cell(editing: boolean, valor: number | undefined, input: ReactNode): ReactNode {
  return editing ? input : <span className="text-slate-700">{valor ?? "—"}</span>;
}

// Celda de texto: input en modo edición, texto en solo lectura.
function textCell(editing: boolean, texto: string, input: ReactNode): ReactNode {
  return editing ? input : <span className="text-slate-700">{texto}</span>;
}

export default function AdminConfigPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [records, setRecords] = useState<ConfigRecord[]>([]);
  const [filtroDZ, setFiltroDZ] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [editRecordKey, setEditRecordKey] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setStations(getStationsConfig());
    setRecords(getConfigRecords());
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  const stationMap = useMemo(
    () => Object.fromEntries(stations.map((s) => [s.id, s])),
    [stations]
  );

  const dzList = useMemo(
    () => [...new Set(stations.map((s) => s.dz).filter(Boolean))] as string[],
    [stations]
  );

  const matches = (s: Station) => {
    if (filtroDZ && s.dz !== filtroDZ) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.estacion.toLowerCase().includes(q) &&
        !(s.rio ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  };

  const filteredStations = stations.filter(matches);
  const filteredRecords = records.filter((r) => {
    const s = stationMap[r.stationId];
    return s ? matches(s) : false;
  });

  const updStation = (id: string, patch: Partial<Station>) =>
    setStations((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const updRecord = (stationId: string, variable: Variable, patch: Partial<ConfigRecord>) =>
    setRecords((p) =>
      p.map((r) =>
        r.stationId === stationId && r.variable === variable ? { ...r, ...patch } : r
      )
    );

  const guardarFicha = (s: Station) => {
    setStationConfig(s.id, {
      preferencia: s.preferencia,
      tipo: s.tipo,
      cota: s.cota,
      cotaFuente: s.cotaFuente,
      variables: s.variables,
      estado: s.estado,
      modoPublicacion: s.modoPublicacion,
    });
    flash(`Ficha guardada: ${s.estacion}`);
  };

  const guardarRecord = (r: ConfigRecord) => {
    setConfigRecord(r);
    flash(`Umbrales/vigencia guardados: ${r.stationId} · ${r.variable}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Configuración de Estaciones</h1>
        <p className="text-sm text-slate-500">
          Tabla de umbrales/vigencia por variable y ficha por estación. Los cambios se guardan como override local.
        </p>
      </div>

      {msg && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-xs uppercase text-slate-500">Dirección Zonal</span>
          <select
            value={filtroDZ}
            onChange={(e) => setFiltroDZ(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {dzList.map((dz) => (
              <option key={dz} value={dz}>{dz}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-xs uppercase text-slate-500">Estación</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por río o estación…"
            className="rounded border border-slate-300 px-2 py-1 text-sm w-64"
          />
        </label>
      </div>

      {/* Tabla 1: Configuración (umbrales + vigencia) */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="rounded-t-lg bg-[#00539b] px-4 py-2">
          <h2 className="text-sm font-bold uppercase text-white">Tabla de configuración (umbrales y vigencia)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-center text-xs">
              <tr>
                <th rowSpan={2} className="p-2 text-left">DZ</th>
                <th rowSpan={2} className="p-2 text-left">Código</th>
                <th rowSpan={2} className="p-2 text-left">Estación</th>
                <th rowSpan={2} className="p-2">Variable</th>
                <th colSpan={3} className="border-b border-slate-200 bg-rose-50 p-2 text-rose-700" title="Crecida: umbrales ascendentes (amarilla ≤ naranja ≤ roja).">Umbrales Avenida ↑</th>
                <th colSpan={3} className="border-b border-slate-200 bg-sky-50 p-2 text-sky-700" title="Sequía: umbrales descendentes (amarilla ≥ naranja ≥ roja).">Umbrales Vigilancia ↓</th>
                <th colSpan={3} className="border-b border-slate-200 bg-slate-100 p-2 text-slate-600" title="Horas que dura el aviso por cada nivel (amarilla/naranja/roja).">Tiempo de vigencia (h)</th>
                <th rowSpan={2} className="p-2">Periodo</th>
                <th rowSpan={2} className="p-2">Acciones</th>
              </tr>
              <tr>
                <th className="p-1">Amarilla</th>
                <th className="p-1">Naranja</th>
                <th className="p-1">Roja</th>
                <th className="p-1">Amarilla</th>
                <th className="p-1">Naranja</th>
                <th className="p-1">Roja</th>
                <th className="p-1">Amarilla</th>
                <th className="p-1">Naranja</th>
                <th className="p-1">Roja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-center">
              {filteredRecords.map((r) => {
                const s = stationMap[r.stationId];
                const tipo = s?.tipo ?? "avenida";
                const uAv = r.umbrales.avenida;
                const uVig = r.umbrales.vigilancia;
                const avOk = ordenValido(uAv, "avenida");
                const vigOk = ordenValido(uVig, "vigilancia");
                const filaValida = avOk && vigOk;
                const bAv = avOk ? "" : "border-red-400";
                const bVig = vigOk ? "" : "border-red-400";
                const key = `${r.stationId}|${r.variable}`;
                const editing = editRecordKey === key;
                return (
                  <tr key={key} className="hover:bg-slate-50">
                    <td className="p-2 text-xs text-left">{s?.dz ?? "—"}</td>
                    <td className="p-2 text-xs text-left text-slate-500">{s?.codigoAuto ?? "—"}</td>
                    <td className="p-2 text-left">
                      <span className="font-semibold">{s?.estacion ?? r.stationId}</span>{" "}
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${tipo === "vigilancia" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"}`}>
                        {tipo === "vigilancia" ? "Vigilancia ↓" : "Avenida ↑"}
                      </span>
                    </td>
                    <td className="p-2 capitalize">
                      {r.variable} <span className="text-xs text-slate-400">({UNIDAD_POR_VARIABLE[r.variable]})</span>
                    </td>
                    <td className="p-2">{cell(editing, uAv?.amarilla, <input type="number" step="any" className={`${inputNum} bg-yellow-50 ${bAv}`} value={uAv?.amarilla ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { umbrales: { ...r.umbrales, avenida: setCampo(uAv, "amarilla", v) } }); }} />)}</td>
                    <td className="p-2">{cell(editing, uAv?.naranja, <input type="number" step="any" className={`${inputNum} bg-orange-50 ${bAv}`} value={uAv?.naranja ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { umbrales: { ...r.umbrales, avenida: setCampo(uAv, "naranja", v) } }); }} />)}</td>
                    <td className="p-2">{cell(editing, uAv?.roja, <input type="number" step="any" className={`${inputNum} bg-red-50 ${bAv}`} value={uAv?.roja ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { umbrales: { ...r.umbrales, avenida: setCampo(uAv, "roja", v) } }); }} />)}</td>
                    <td className="p-2">{cell(editing, uVig?.amarilla, <input type="number" step="any" className={`${inputNum} bg-yellow-50 ${bVig}`} value={uVig?.amarilla ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { umbrales: { ...r.umbrales, vigilancia: setCampo(uVig, "amarilla", v) } }); }} />)}</td>
                    <td className="p-2">{cell(editing, uVig?.naranja, <input type="number" step="any" className={`${inputNum} bg-orange-50 ${bVig}`} value={uVig?.naranja ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { umbrales: { ...r.umbrales, vigilancia: setCampo(uVig, "naranja", v) } }); }} />)}</td>
                    <td className="p-2">{cell(editing, uVig?.roja, <input type="number" step="any" className={`${inputNum} bg-red-50 ${bVig}`} value={uVig?.roja ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { umbrales: { ...r.umbrales, vigilancia: setCampo(uVig, "roja", v) } }); }} />)}</td>
                    <td className="p-2">{cell(editing, r.tiempoVigenciaHrs.amarilla, <input type="number" step="1" className={`${inputNum} bg-yellow-50`} value={r.tiempoVigenciaHrs.amarilla} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { tiempoVigenciaHrs: { ...r.tiempoVigenciaHrs, amarilla: v } }); }} />)}</td>
                    <td className="p-2">{cell(editing, r.tiempoVigenciaHrs.naranja, <input type="number" step="1" className={`${inputNum} bg-orange-50`} value={r.tiempoVigenciaHrs.naranja} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { tiempoVigenciaHrs: { ...r.tiempoVigenciaHrs, naranja: v } }); }} />)}</td>
                    <td className="p-2">{cell(editing, r.tiempoVigenciaHrs.roja, <input type="number" step="1" className={`${inputNum} bg-red-50`} value={r.tiempoVigenciaHrs.roja} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updRecord(r.stationId, r.variable, { tiempoVigenciaHrs: { ...r.tiempoVigenciaHrs, roja: v } }); }} />)}</td>
                    <td className="p-2 text-xs text-slate-500 whitespace-nowrap">
                      {r.periodo.inicio} — {r.periodo.final ?? "vigente"}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {editing ? (
                        <>
                          <button
                            onClick={() => { guardarRecord(r); setEditRecordKey(null); }}
                            disabled={!filaValida}
                            title={filaValida ? "Guardar" : "Corrige el orden de los umbrales"}
                            className={`rounded px-2.5 py-1 text-xs font-semibold ${filaValida ? "bg-[#00539b] text-white hover:bg-[#0070ba]" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}
                          >
                            Guardar
                          </button>
                          <button onClick={() => { setRecords(getConfigRecords()); setEditRecordKey(null); }} className="ml-1 rounded bg-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-300">Cancelar</button>
                          {!filaValida && <span className="ml-1 text-xs text-red-500" title="Umbrales invertidos">⚠</span>}
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditRecordKey(key)} className="rounded bg-[#00539b] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0070ba]">✏️ Editar</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr><td colSpan={15} className="p-4 text-center text-slate-400">Sin registros para el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tabla 2: Ficha por estación */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="rounded-t-lg bg-[#00539b] px-4 py-2">
          <h2 className="text-sm font-bold uppercase text-white">Ficha de estaciones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-center text-xs">
              <tr>
                <th className="p-2 text-left">DZ</th>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Estación</th>
                <th className="p-2 text-left">Río</th>
                <th className="p-2">Preferencia</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Publicación</th>
                <th className="p-2">Cota</th>
                <th className="p-2">Fuente cota</th>
                <th className="p-2">Variables</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-center">
              {filteredStations.map((s) => {
                const vars = s.variables ?? ["caudal", "nivel"];
                const varsLabel = vars.map((v) => (v === "caudal" ? "Caudal" : "Nivel")).join(", ");
                const editing = editId === s.id;
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2 text-xs text-left">{s.dz ?? "—"}</td>
                    <td className="p-2 text-xs text-left text-slate-500">{s.codigoAuto ?? "—"}</td>
                    <td className="p-2 font-semibold text-left">{s.estacion}</td>
                    <td className="p-2 text-xs text-left text-slate-500">{s.rio}</td>
                    <td className="p-2">
                      {textCell(editing, PREF_LABEL[s.preferencia ?? "caudal"], (
                        <select className={inputSel} value={s.preferencia ?? "caudal"} onChange={(e) => updStation(s.id, { preferencia: e.target.value as Variable })}>
                          <option value="caudal">Caudal</option>
                          <option value="nivel">Nivel</option>
                        </select>
                      ))}
                    </td>
                    <td className="p-2">
                      {textCell(editing, TIPO_LABEL[s.tipo ?? "avenida"], (
                        <select className={inputSel} value={s.tipo ?? "avenida"} onChange={(e) => updStation(s.id, { tipo: e.target.value as "avenida" | "vigilancia" })}>
                          <option value="avenida">Avenida</option>
                          <option value="vigilancia">Vigilancia</option>
                        </select>
                      ))}
                    </td>
                    <td className="p-2">
                      {textCell(editing, PUB_LABEL[s.modoPublicacion ?? "automatico"], (
                        <select className={inputSel} value={s.modoPublicacion ?? "automatico"} onChange={(e) => updStation(s.id, { modoPublicacion: e.target.value as "automatico" | "manual" })}>
                          <option value="automatico">Automática</option>
                          <option value="manual">Manual</option>
                        </select>
                      ))}
                    </td>
                    <td className="p-2">
                      {cell(editing, s.cota ?? undefined, (
                        <input type="number" step="any" className={inputNum} value={s.cota ?? ""}
                          onChange={(e) => { const raw = e.target.value; updStation(s.id, { cota: raw === "" ? null : parseFloat(raw) }); }} />
                      ))}
                    </td>
                    <td className="p-2">
                      {textCell(editing, COTA_LABEL[s.cotaFuente ?? "inventario-altitud"], (
                        <select className={inputSel} value={s.cotaFuente ?? "inventario-altitud"} onChange={(e) => updStation(s.id, { cotaFuente: e.target.value as "oficial" | "inventario-altitud" | "dem" })}>
                          <option value="oficial">Oficial (DZ)</option>
                          <option value="inventario-altitud">Inventario (altitud)</option>
                          <option value="dem">DEM</option>
                        </select>
                      ))}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {textCell(editing, varsLabel, (
                        <>
                          {(["caudal", "nivel"] as Variable[]).map((v) => (
                            <label key={v} className="mr-2 inline-flex items-center gap-1 text-xs">
                              <input type="checkbox" checked={vars.includes(v)}
                                onChange={(e) => {
                                  const next = e.target.checked ? [...new Set([...vars, v])] : vars.filter((x) => x !== v);
                                  updStation(s.id, { variables: next });
                                }} />
                              {v === "caudal" ? "Caudal" : "Nivel"}
                            </label>
                          ))}
                        </>
                      ))}
                    </td>
                    <td className="p-2">
                      {textCell(editing, ESTADO_LABEL[s.estado ?? "activa"], (
                        <select className={inputSel} value={s.estado ?? "activa"} onChange={(e) => updStation(s.id, { estado: e.target.value as "activa" | "mantenimiento" })}>
                          <option value="activa">Activa</option>
                          <option value="mantenimiento">Mantenimiento</option>
                        </select>
                      ))}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {editing ? (
                        <>
                          <button onClick={() => { guardarFicha(s); setEditId(null); }} className="rounded bg-[#00539b] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0070ba]">Guardar</button>
                          <button onClick={() => { setStations(getStationsConfig()); setEditId(null); }} className="ml-1 rounded bg-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-300">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditId(s.id)} className="rounded bg-[#00539b] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0070ba]">✏️ Editar</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStations.length === 0 && (
                <tr><td colSpan={12} className="p-4 text-center text-slate-400">Sin estaciones para el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
