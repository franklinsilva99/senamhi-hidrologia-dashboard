"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Alert, NivelAlerta, Observation, Station, TipoAviso } from "@/lib/types";

const MapHydro = dynamic(() => import("@/components/MapHydro"), { ssr: false });

type Filtro = "todos" | "rojo" | "naranja" | "amarillo" | "vigentes";
type SortKey = "titulo" | "nro" | "inicio" | "fin" | "duracion" | "nivel";

const nivelText: Record<string, string> = {
  ROJO: "text-[#dc2626]",
  NARANJA: "text-[#ea580c]",
  AMARILLO: "text-[#d97706]",
};
const nivelRank: Record<string, number> = { ROJO: 3, NARANJA: 2, AMARILLO: 1 };

export default function AvisosTabs({
  alerts, stations, latest,
}: {
  alerts: Alert[];
  stations: Station[];
  latest: Record<string, Observation>;
}) {
  const [tab, setTab] = useState<"mapa" | "lista">("lista");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("inicio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const counts = useMemo(() => ({
    todos: alerts.length,
    rojo: alerts.filter((a) => a.nivel === "ROJO").length,
    naranja: alerts.filter((a) => a.nivel === "NARANJA").length,
    amarillo: alerts.filter((a) => a.nivel === "AMARILLO").length,
    vigentes: alerts.filter((a) => a.vigente).length,
  }), [alerts]);

  const vigenteIds = useMemo(
    () => new Set(alerts.filter((a) => a.vigente).map((a) => a.stationId)),
    [alerts],
  );

  // Tipo del aviso vigente por estación + tipo mayoritario (default de la tarjeta de niveles)
  const tipoPorEstacion = useMemo(() => {
    const m: Record<string, TipoAviso> = {};
    for (const a of alerts) if (a.vigente) m[a.stationId] = a.tipo;
    return m;
  }, [alerts]);

  // Nivel del aviso vigente por estación (nivel de peligrosidad publicado)
  const nivelPorEstacion = useMemo(() => {
    const m: Record<string, NivelAlerta> = {};
    for (const a of alerts) if (a.vigente) m[a.stationId] = a.nivel;
    return m;
  }, [alerts]);

  // Id del aviso vigente por estación (ca-ce) para enlazar al detalle
  const avisoIdPorEstacion = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of alerts) if (a.vigente) m[a.stationId] = `${a.ca}-${a.ce}`;
    return m;
  }, [alerts]);

  const tipoDefault = useMemo<TipoAviso>(() => {
    const tipos = Object.values(tipoPorEstacion);
    const vigilancia = tipos.filter((t) => t === "vigilancia").length;
    return vigilancia > tipos.length / 2 ? "vigilancia" : "avenida";
  }, [tipoPorEstacion]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (filtro === "vigentes" && !a.vigente) return false;
      if (filtro === "rojo" && a.nivel !== "ROJO") return false;
      if (filtro === "naranja" && a.nivel !== "NARANJA") return false;
      if (filtro === "amarillo" && a.nivel !== "AMARILLO") return false;
      if (q) {
        const st = stations.find((s) => s.id === a.stationId);
        const blob = `${a.titulo} ${a.nro} ${a.nivel} ${st?.estacion ?? ""} ${st?.rio ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, filtro, search, stations]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (a.vigente !== b.vigente) return a.vigente ? -1 : 1;
      let cmp = 0;
      switch (sortKey) {
        case "titulo": cmp = a.titulo.localeCompare(b.titulo); break;
        case "nro": cmp = a.nro - b.nro; break;
        case "inicio": cmp = a.inicio.localeCompare(b.inicio); break;
        case "fin": cmp = a.fin.localeCompare(b.fin); break;
        case "duracion": cmp = a.duracionHoras - b.duracionHoras; break;
        case "nivel": cmp = (nivelRank[a.nivel] ?? 0) - (nivelRank[b.nivel] ?? 0); break;
      }
      const primary = cmp * dir;
      if (primary !== 0) return primary;
      return b.nro - a.nro;
    });
    return arr;
  }, [filtrados, sortKey, sortDir]);

  const total = ordenados.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageClamped = Math.min(page, totalPages);
  const paged = ordenados.slice((pageClamped - 1) * perPage, pageClamped * perPage);

  const cambiarFiltro = (f: Filtro) => { setFiltro(f); setPage(1); };
  const cambiarSearch = (v: string) => { setSearch(v); setPage(1); };
  const cambiarPerPage = (n: number) => { setPerPage(n); setPage(1); };
  const ordenar = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const th = (label: string, key: SortKey, extra = "") => (
    <th
      className={`py-3.5 px-3 font-bold cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap ${extra}`}
      onClick={() => ordenar(key)}
    >
      <div className={`flex items-center gap-1 ${extra.includes("text-right") ? "justify-end" : extra.includes("text-center") ? "justify-center" : "justify-between"}`}>
        <span>{label}</span>
        <span className="text-gray-400 font-normal">⇅</span>
      </div>
    </th>
  );

  const tabBtn = (k: "mapa" | "lista", label: string) => (
    <button
      onClick={() => setTab(k)}
      className={`px-5 py-2.5 text-sm rounded-t-md ${tab === k
        ? "font-semibold bg-white text-senamhi-navy border-t-2 border-senamhi-blue border-l border-r border-gray-200 -mb-px shadow-sm"
        : "font-medium text-senamhi-blue hover:text-senamhi-navy hover:bg-gray-100"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <nav aria-label="Tabs" className="border-b border-gray-200">
        <div className="flex gap-1 sm:gap-2">
          {tabBtn("mapa", "Mapa")}
          {tabBtn("lista", "Lista")}
        </div>
      </nav>

      {tab === "mapa" ? (
        <MapHydro
          stations={stations}
          latest={latest}
          heightClass="h-[840px]"
          vigenteIds={vigenteIds}
          tipoPorEstacion={tipoPorEstacion}
          nivelPorEstacion={nivelPorEstacion}
          avisoIdPorEstacion={avisoIdPorEstacion}
          tipoDefault={tipoDefault}
          mostrarNiveles
        />
      ) : (
        <>
          {/* Filtro rápido */}
          <div className="bg-white p-4 rounded-t-lg border border-b-0 border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-semibold text-gray-700 mr-1 uppercase tracking-wider">Filtro Rápido:</span>
                <button onClick={() => cambiarFiltro("todos")} className={`px-2.5 py-1 rounded font-medium ${filtro === "todos" ? "bg-senamhi-blue text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>Todos ({counts.todos})</button>
                <button onClick={() => cambiarFiltro("rojo")} className={`px-2.5 py-1 rounded border font-medium ${filtro === "rojo" ? "bg-red-100 border-red-300 text-red-800" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"}`}><span className="w-2 h-2 inline-block rounded-full bg-red-600 mr-1" />Rojo (Peligro)</button>
                <button onClick={() => cambiarFiltro("naranja")} className={`px-2.5 py-1 rounded border font-medium ${filtro === "naranja" ? "bg-orange-100 border-orange-300 text-orange-800" : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"}`}><span className="w-2 h-2 inline-block rounded-full bg-orange-500 mr-1" />Naranja (Alerta)</button>
                <button onClick={() => cambiarFiltro("amarillo")} className={`px-2.5 py-1 rounded border font-medium ${filtro === "amarillo" ? "bg-yellow-100 border-yellow-300 text-yellow-900" : "bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100"}`}><span className="w-2 h-2 inline-block rounded-full bg-yellow-500 mr-1" />Amarillo (Prevención)</button>
                <button onClick={() => cambiarFiltro("vigentes")} className={`px-2.5 py-1 rounded font-bold border ${filtro === "vigentes" ? "bg-red-200 border-red-400 text-red-900" : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"}`}>Avisos Vigentes ({counts.vigentes})</button>
              </div>
              <div className="text-xs text-gray-500 flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-ping" />
                {counts.vigentes} avisos en periodo de vigencia
              </div>
            </div>
          </div>

          {/* Controles */}
          <div className="bg-gray-50 p-4 border-l border-r border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <label className="text-sm">Mostrar</label>
              <select value={perPage} onChange={(e) => cambiarPerPage(Number(e.target.value))} className="text-sm border border-gray-300 rounded py-1.5 pl-3 pr-8 bg-white cursor-pointer">
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-sm">registros</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 w-full sm:w-auto">
              <label className="text-sm font-medium whitespace-nowrap">Buscar:</label>
              <input value={search} onChange={(e) => cambiarSearch(e.target.value)} type="search" placeholder="Filtrar por río, estación o nivel..." className="w-full sm:w-64 text-sm border border-gray-300 rounded py-1.5 px-3 bg-white" />
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white border border-gray-200 shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs sm:text-sm">
              <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 select-none">
                <tr>
                  {th("Aviso", "titulo", "w-5/12")}
                  {th("Nro.", "nro")}
                  {th("Inicio", "inicio")}
                  {th("Fin", "fin")}
                  {th("Duración", "duracion", "text-right")}
                  {th("Nivel", "nivel", "text-center")}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                {paged.map((a) => (
                  <tr key={`${a.ca}-${a.ce}`} className={a.vigente ? "bg-red-50/40 hover:bg-red-100/50 transition-colors" : "hover:bg-blue-50/40 transition-colors"}>
                    <td className={`py-3 px-4 ${a.vigente ? "font-bold text-red-600" : ""}`}>
                      <a className={a.vigente ? "hover:underline" : "text-senamhi-lightblue hover:underline"} href={`/avisos/${a.ca}-${a.ce}`}>{a.titulo}</a>
                    </td>
                    <td className={`py-3 px-3 whitespace-nowrap ${a.vigente ? "font-bold text-red-600" : "text-senamhi-lightblue"}`}>{a.nro}{a.vigente ? " (vigente)" : ""}</td>
                    <td className={`py-3 px-3 whitespace-nowrap ${a.vigente ? "font-bold text-red-600" : "text-gray-600"}`}>{a.inicio}</td>
                    <td className={`py-3 px-3 whitespace-nowrap ${a.vigente ? "font-bold text-red-600" : "text-gray-600"}`}>{a.fin}</td>
                    <td className={`py-3 px-3 text-right whitespace-nowrap ${a.vigente ? "font-bold text-red-600" : "text-gray-700"}`}>{a.duracionHoras}</td>
                    <td className={`py-3 px-4 text-center whitespace-nowrap font-bold ${nivelText[a.nivel]}`}>{a.nivel}</td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-gray-500">Sin avisos para el filtro seleccionado.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-gray-100 text-gray-700 font-bold border-t border-gray-200">
                <tr>
                  <th className="py-3 px-4 text-left">Aviso</th>
                  <th className="py-3 px-3 text-left">Nro.</th>
                  <th className="py-3 px-3 text-left">Inicio</th>
                  <th className="py-3 px-3 text-left">Fin</th>
                  <th className="py-3 px-3 text-right">Duración</th>
                  <th className="py-3 px-4 text-center">Nivel</th>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Paginación */}
          <div className="py-2 flex flex-col md:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-gray-600">
            <div className="font-medium">
              Mostrando registros del {total === 0 ? 0 : (pageClamped - 1) * perPage + 1} al {Math.min(pageClamped * perPage, total)} de un total de {total} registros
            </div>
            <nav aria-label="Paginación" className="inline-flex -space-x-px">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageClamped <= 1} className="px-3 py-1.5 border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50">anterior</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map((n) => (
                <button key={n} onClick={() => setPage(n)} className={`px-3 py-1.5 border ${n === pageClamped ? "border-senamhi-blue bg-senamhi-blue text-white font-semibold" : "border-gray-300 bg-white text-senamhi-lightblue hover:bg-gray-50"}`}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageClamped >= totalPages} className="px-3 py-1.5 border border-gray-300 bg-white text-senamhi-lightblue hover:bg-gray-50 disabled:opacity-50">siguiente</button>
            </nav>
          </div>

          {/* Avisos anteriores + Leyenda */}
          <div className="mt-4 pt-6 border-t border-gray-200 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 mb-3">Avisos Anteriores</h2>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                <li><a className="text-senamhi-lightblue hover:underline font-medium" href="#">Avisos Hidrológicos Anteriores</a></li>
                <li><a className="text-senamhi-lightblue hover:underline font-medium" href="#">Reporte de Estiajes y Crecidas Históricas</a></li>
                <li><a className="text-senamhi-lightblue hover:underline font-medium" href="#">Boletines Hidrológicos Mensuales</a></li>
              </ul>
            </div>
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Significado de los Niveles de Avisos Hidrológicos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-red-50 border-l-4 border-red-600 rounded-r">
                  <div className="font-bold text-xs text-red-700 uppercase">Nivel Rojo</div>
                  <p className="text-xs text-red-900 mt-1">Condición crítica. Posible desborde inminente o estiaje severo con afectación alta en riberas y actividades.</p>
                </div>
                <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded-r">
                  <div className="font-bold text-xs text-orange-700 uppercase">Nivel Naranja</div>
                  <p className="text-xs text-orange-900 mt-1">Condición importante de riesgo. Incremento o descenso pronunciado que requiere preparación activa.</p>
                </div>
                <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-r">
                  <div className="font-bold text-xs text-yellow-800 uppercase">Nivel Amarillo</div>
                  <p className="text-xs text-yellow-900 mt-1">Condición anómala. Variación ligera en los caudales normales; mantenerse informado ante evolución.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
