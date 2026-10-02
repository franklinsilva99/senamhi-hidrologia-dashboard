"use client";
import { useEffect, useMemo, useState } from "react";
import { getStationsConfig, setStationConfig } from "@/lib/infra/stationConfig";
import type { Station } from "@/lib/domain/types";

// Poblado en edición: lat/lon como string para evitar NaN al vaciar el input.
interface PobladoEdit {
  nombre: string;
  lat: string;
  lon: string;
}

export default function AdminCentrosPobladosPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [filtroDZ, setFiltroDZ] = useState("");
  const [search, setSearch] = useState("");
  const [editStationId, setEditStationId] = useState<string | null>(null);
  const [poblados, setPoblados] = useState<PobladoEdit[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setStations(getStationsConfig());
  }, []);

  const dzList = useMemo(
    () => [...new Set(stations.map((s) => s.dz).filter(Boolean))] as string[],
    [stations],
  );

  const stationMap = useMemo(
    () => Object.fromEntries(stations.map((s) => [s.id, s])),
    [stations],
  );

  const matches = (s: Station) => {
    if (filtroDZ && s.dz !== filtroDZ) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.estacion.toLowerCase().includes(q) && !(s.rio ?? "").toLowerCase().includes(q))
        return false;
    }
    return true;
  };

  const filtered = stations.filter(matches);
  const editStation = editStationId ? stationMap[editStationId] : null;

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  const abrirEdicion = (s: Station) => {
    setEditStationId(s.id);
    setPoblados(
      (s.pobladosGeo ?? []).map((p) => ({
        nombre: p.nombre,
        lat: String(p.lat),
        lon: String(p.lon),
      })),
    );
  };

  const cerrarEdicion = () => {
    setEditStationId(null);
    setPoblados([]);
  };

  const updatePoblado = (idx: number, patch: Partial<PobladoEdit>) =>
    setPoblados((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const addPoblado = () =>
    setPoblados((p) => [...p, { nombre: "", lat: "", lon: "" }]);

  const removePoblado = (idx: number) =>
    setPoblados((p) => p.filter((_, i) => i !== idx));

  const guardar = () => {
    if (!editStationId) return;
    setStationConfig(editStationId, {
      poblados: poblados.map((p) => p.nombre),
      pobladosGeo: poblados.map((p) => ({
        nombre: p.nombre,
        lat: parseFloat(p.lat) || 0,
        lon: parseFloat(p.lon) || 0,
      })),
    });
    setStations(getStationsConfig());
    flash(`Centros poblados guardados: ${editStation?.estacion ?? editStationId}`);
    cerrarEdicion();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Centros Poblados Afectados</h1>
        <p className="text-sm text-slate-500">
          Catálogo de centros poblados afectados por estación. Los cambios se guardan como override local y se congelan en los avisos nuevos.
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
            className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      {/* Tabla */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="rounded-t-lg bg-[#00539b] px-4 py-2">
          <h2 className="text-sm font-bold uppercase text-white">Estaciones y centros poblados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-center text-xs">
              <tr>
                <th className="p-2 text-left">DZ</th>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Estación</th>
                <th className="p-2 text-left">Río</th>
                <th className="p-2 text-left">Departamento</th>
                <th className="p-2 text-left">Provincia</th>
                <th className="p-2 text-left">Distritos</th>
                <th className="p-2 text-left">Centros Poblados</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-center">
              {filtered.map((s) => {
                const nombres = s.poblados ?? [];
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2 text-left text-xs">{s.dz ?? "—"}</td>
                    <td className="p-2 text-left text-xs text-slate-500">{s.codigoAuto ?? "—"}</td>
                    <td className="p-2 text-left font-semibold">{s.estacion}</td>
                    <td className="p-2 text-left text-xs text-slate-500">{s.rio}</td>
                    <td className="p-2 text-left text-xs">{s.departamento ?? "—"}</td>
                    <td className="p-2 text-left text-xs text-slate-500">{(s.provincia ?? []).join(", ") || "—"}</td>
                    <td className="p-2 text-left text-xs text-slate-500">{(s.distritos ?? []).join(", ") || "—"}</td>
                    <td className="p-2 text-left">
                      <div className="flex flex-wrap items-center gap-1">
                        {nombres.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          nombres.map((n) => (
                            <span key={n} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{n}</span>
                          ))
                        )}
                        <span className="self-center text-[10px] text-slate-400">({nombres.length})</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => abrirEdicion(s)}
                        className="rounded bg-[#00539b] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0070ba]"
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-slate-400">Sin estaciones para el filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de edición */}
      {editStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Centros poblados — {editStation.estacion}</h3>
              <button onClick={cerrarEdicion} className="text-xl text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-xs text-slate-500">
              Río {editStation.rio} · DZ {editStation.dz ?? "—"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-center text-xs">
                  <tr>
                    <th className="p-2 text-left">Nombre</th>
                    <th className="p-2">Latitud</th>
                    <th className="p-2">Longitud</th>
                    <th className="p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-center">
                  {poblados.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 text-left">
                        <input
                          type="text"
                          value={p.nombre}
                          onChange={(e) => updatePoblado(i, { nombre: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={p.lat}
                          onChange={(e) => updatePoblado(i, { lat: e.target.value })}
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={p.lon}
                          onChange={(e) => updatePoblado(i, { lon: e.target.value })}
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => removePoblado(i)}
                          className="rounded bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {poblados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">Sin poblados. Agrega uno.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={addPoblado}
                className="rounded bg-[#00539b] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0070ba]"
              >
                + Agregar poblado
              </button>
              <div className="flex-1" />
              <button onClick={cerrarEdicion} className="rounded border px-4 py-1.5 text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={guardar}
                className="rounded bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
