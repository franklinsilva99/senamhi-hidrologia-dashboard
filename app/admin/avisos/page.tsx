"use client";
import { useState, useEffect } from "react";
import { getAlerts, loadAlerts, saveAlerts, getLatestMerged, getSeriesMerged, getMockNow } from "@/lib/infra/data";
import { getStationsConfig } from "@/lib/infra/stationConfig";
import { detectarAvisos } from "@/lib/domain/deteccion";
import { getConfigVigente } from "@/lib/infra/configRecords";
import { existeAvisoPrevio, crearAviso, evaluarAccionAviso, siguienteNro, siguienteCA, aplicarAviso, procesarDeteccion } from "@/lib/domain/avisos";
import type { Alert, DeteccionAviso, Station } from "@/lib/domain/types";
import { USUARIO } from "@/lib/sesion";
import ChartAviso from "@/components/ChartAviso";

const badgeNivel: Record<string, string> = {
  AMARILLO: "bg-[#ffeb3b] text-black",
  NARANJA: "bg-[#fca326] text-white",
  ROJO: "bg-[#ee3d43] text-white",
};

export default function AdminAvisosPage() {
  const [alerts, setAlerts] = useState<Alert[]>(getAlerts);
  const [filtroDZ, setFiltroDZ] = useState("");
  const [filtroStation, setFiltroStation] = useState("");
  const [filtroFechaIni, setFiltroFechaIni] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [searchText, setSearchText] = useState("");
  const [previewAviso, setPreviewAviso] = useState<Alert | null>(null);

  // ── Estado ──
  const [deteccion, setDeteccion] = useState<DeteccionAviso[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setAlerts(loadAlerts());
    setStations(getStationsConfig());
    setDeteccion(detectarAvisos(getStationsConfig(), getLatestMerged(), getConfigVigente, getMockNow()));
  }, []);

  const stationMap = Object.fromEntries(stations.map((s) => [s.id, s]));
  const dzList = [...new Set(stations.map((s) => s.dz).filter(Boolean))];
  // Última lectura por estación, de la serie fusionada (caudal + nivel).
  const latestOverride = getLatestMerged();

  const filtered = alerts.filter((a) => {
    const st = stationMap[a.stationId];
    if (filtroDZ && st?.dz !== filtroDZ) return false;
    if (filtroStation && a.stationId !== filtroStation) return false;
    if (filtroFechaIni && a.inicio < filtroFechaIni) return false;
    if (filtroFechaFin && a.fin > filtroFechaFin) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (
        !a.titulo.toLowerCase().includes(q) &&
        !a.nro.toString().includes(q) &&
        !(st?.estacion ?? "").toLowerCase().includes(q) &&
        !(st?.dz ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.vigente !== b.vigente) return a.vigente ? -1 : 1;
    return b.inicio.localeCompare(a.inicio) || b.nro - a.nro;
  });

  const estacionesConAlerta = deteccion.filter((d) => d.excedido);

  // ── Actualizar detección ──
  const handleActualizarDeteccion = () => {
    const det = detectarAvisos(stations, latestOverride, getConfigVigente, getMockNow());
    setDeteccion(det);
    const { next, textos } = procesarDeteccion(alerts, det, {
      stations,
      latest: latestOverride,
      configVigenteDe: getConfigVigente,
      serieDe: (id) => getSeriesMerged(id),
      mockNow: getMockNow(),
    });
    if (textos.length > 0) {
      setAlerts(next);
      saveAlerts(next);
      setMsg(`Publicación automática: ${textos.join(" ")}`);
      setTimeout(() => setMsg(""), 6000);
    }
  };

  const handleCrearAviso = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    if (!station) return;
    const preferencia = station.preferencia ?? "caudal";
    const record = getConfigVigente(stationId, preferencia, getMockNow());
    if (!record) return;
    const aviso = crearAviso({
      station,
      latest: latestOverride,
      record,
      preferencia,
      mockNow: getMockNow(),
      serie: getSeriesMerged(stationId),
      nro: siguienteNro(alerts),
      ca: siguienteCA(alerts),
    });
    setPreviewAviso(aviso);
  };

  const handlePublicar = () => {
    if (!previewAviso) return;
    const { next, texto } = aplicarAviso(alerts, previewAviso);
    setAlerts(next);
    saveAlerts(next);
    setPreviewAviso(null);
    setDeteccion(detectarAvisos(stations, latestOverride, getConfigVigente, getMockNow()));
    setMsg(texto);
    setTimeout(() => setMsg(""), 5000);
  };

  const handleLimpiarDatos = () => {
    const originales = getAlerts();
    setAlerts(originales);
    saveAlerts(originales);
    setMsg(`Datos restaurados a los ${originales.length} avisos base.`);
    setTimeout(() => setMsg(""), 4000);
  };

  // ── Habilitar / Deshabilitar un aviso (toggle de vigencia) ──
  const toggleVigente = (aviso: Alert) => {
    const next = alerts.map((x) =>
      x.ca === aviso.ca && x.ce === aviso.ce ? { ...x, vigente: !x.vigente } : x
    );
    setAlerts(next);
    saveAlerts(next);
    setMsg(`Aviso #${aviso.nro} ${aviso.vigente ? "deshabilitado" : "habilitado"}.`);
    setTimeout(() => setMsg(""), 4000);
  };

  // Acción del preview (misma regla de negocio que al publicar).
  const accionPreview = previewAviso
    ? evaluarAccionAviso(previewAviso.stationId, previewAviso.nivel, alerts)
    : null;

  return (
    <div className="space-y-5">
      {/* ── SECCIÓN 1: Detección Automática ── */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="bg-[#00539b] text-white px-4 py-2 rounded-t-lg flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase">Detección Automática de Avisos</h2>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{estacionesConAlerta.length} estación(es) con alerta</span>
        </div>
        <div className="p-4">
          {estacionesConAlerta.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Ninguna estación supera umbrales en este momento. Ajuste los umbrales en Configuración General y actualice la detección.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-2">Estación</th>
                    <th className="p-2">Río</th>
                    <th className="p-2">DZ</th>
                    <th className="p-2">Preferencia</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Modo</th>
                    <th className="p-2">Valor Actual</th>
                    <th className="p-2">Umbral Detectado</th>
                    <th className="p-2">Aviso Previo</th>
                    <th className="p-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {estacionesConAlerta.map((d) => {
                    const st = stationMap[d.stationId];
                    const previo = existeAvisoPrevio(d.stationId, alerts);
                    const accion = evaluarAccionAviso(d.stationId, d.umbral ?? "", alerts);
                    const valorMostrar = d.preferencia === "caudal" ? d.valorActual : d.valorAbsoluto ?? d.valorActual;
                    const unidadMostrar = d.preferencia === "caudal" ? "m³/s" : "m.s.n.m.";
                    return (
                      <tr key={d.stationId} className="border-t hover:bg-slate-50">
                        <td className="p-2 font-semibold">{st?.estacion ?? d.stationId}</td>
                        <td className="p-2 text-xs">{st?.rio}</td>
                        <td className="p-2 text-xs">{st?.dz ?? "—"}</td>
                        <td className="p-2 text-xs">{d.preferencia}</td>
                        <td className="p-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded ${d.tipo === "vigilancia" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"}`}>{d.tipo}</span>
                        </td>
                        <td className="p-2 text-xs">
                          <span className={st?.modoPublicacion === "manual" ? "text-slate-500" : "text-green-700"}>
                            {st?.modoPublicacion === "manual" ? "Manual" : "Auto"}
                          </span>
                        </td>
                        <td className="p-2 font-semibold">
                          {valorMostrar.toFixed(2)} {unidadMostrar}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${badgeNivel[d.umbral ?? ""]}`}>
                            {d.umbral}
                          </span>
                        </td>
                        <td className="p-2 text-xs">
                          {previo ? (
                            <span className={accion === "reemplazar" ? "text-[#fca326] font-semibold" : "text-slate-400"}>
                              #{previo.nro} ({previo.nivel}) {accion === "reemplazar" ? "→ reemplazar" : "= sin cambios"}
                            </span>
                          ) : (
                            <span className="text-green-600">Sin previo</span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleCrearAviso(d.stationId)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                              title="Visualizar aviso detectado"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button
                              onClick={() => handleCrearAviso(d.stationId)}
                              disabled={accion === "mantener"}
                              className={`px-3 py-1 rounded text-xs font-semibold ${accion === "mantener" ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-[#00539b] text-white hover:bg-[#0070ba]"}`}
                              title={accion === "mantener" ? "El aviso vigente ya tiene el mismo nivel" : "Crear aviso"}
                            >
                              {accion === "mantener" ? "Sin cambios" : accion === "reemplazar" ? "Reemplazar" : "Crear aviso"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={handleActualizarDeteccion}
              className="text-xs text-[#00539b] hover:underline font-semibold"
            >
              ↻ Actualizar detección
            </button>
            <button
              onClick={handleLimpiarDatos}
              className="text-xs text-red-500 hover:underline"
            >
              🗑 Limpiar avisos creados
            </button>
            <span className="text-xs text-slate-400">
              ({alerts.length} avisos en memoria)
            </span>
          </div>
        </div>
      </div>

      {/* ── MODAL: Preview del aviso ── */}
      {previewAviso && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Preview del Aviso</h3>
              <button onClick={() => setPreviewAviso(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="bg-[#f0f2f5] rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">Aviso N°{previewAviso.nro}</span>
                <span className={`px-3 py-1 rounded text-xs font-bold ${badgeNivel[previewAviso.nivel]}`}>{previewAviso.nivel}</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${previewAviso.tipo === "vigilancia" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"}`}>{previewAviso.tipo}</span>
              </div>
              <p className="text-right text-xs text-slate-500">Fecha de emisión: {previewAviso.fechaEmision}</p>
              <h4 className="text-lg font-bold text-[#dc2626] text-center">{previewAviso.titulo}</h4>
              <div className="text-sm space-y-1">
                <p><strong>Fecha de inicio:</strong> {previewAviso.inicio}</p>
                <p><strong>Fecha de final:</strong> {previewAviso.fin}</p>
                <p><strong>Plazo:</strong> Plazo {previewAviso.plazo}</p>
              </div>
              <p className="text-sm text-justify">{previewAviso.descripcion}</p>
              <p className="text-xs text-slate-500"><strong>Recomendaciones:</strong> {previewAviso.recomendaciones}</p>
              <p className="text-xs text-slate-400">ca: {previewAviso.ca} · ce: {previewAviso.ce}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <ChartAviso
                series={previewAviso.serie ?? []}
                titulo={`HIDROGRAMA DE ${previewAviso.cuerpoAgua}`}
                estacion={stationMap[previewAviso.stationId]?.estacion?.toUpperCase() ?? ""}
                preferencia={previewAviso.preferencia}
                tipo={previewAviso.tipo}
                cota={previewAviso.cota}
                umbralAmarilla={previewAviso.umbrales?.amarilla}
                umbralNaranja={previewAviso.umbrales?.naranja}
                umbralRoja={previewAviso.umbrales?.roja}
              />
            </div>
            {accionPreview === "mantener" && (
              <p className="text-sm text-slate-500 text-center">
                Sin cambios: la estación ya tiene un aviso vigente de este nivel.
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPreviewAviso(null)} className="px-4 py-2 rounded border text-sm hover:bg-slate-50">
                {accionPreview === "mantener" ? "Cerrar" : "Cancelar"}
              </button>
              {accionPreview !== "mantener" && (
                <button onClick={handlePublicar} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700">Publicar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Mensaje de éxito ── */}
      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm font-semibold">
          ✓ {msg}
        </div>
      )}

      {/* ── SECCIÓN 2: Parámetros de búsqueda ── */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="bg-[#00539b] text-white px-4 py-2 rounded-t-lg">
          <h2 className="text-sm font-bold uppercase">Parámetros de búsqueda</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase">Dirección Zonal</label>
              <select value={filtroDZ} onChange={(e) => setFiltroDZ(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                <option value="">Seleccione</option>
                {dzList.map((dz) => <option key={dz} value={dz!}>{dz}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase">Estación</label>
              <select value={filtroStation} onChange={(e) => setFiltroStation(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                <option value="">Seleccione</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.estacion} ({s.rio})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase">Fecha Inicio</label>
              <input type="date" value={filtroFechaIni} onChange={(e) => setFiltroFechaIni(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase">Fecha Final</label>
              <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: Lista de avisos ── */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="bg-[#00539b] text-white px-4 py-2 rounded-t-lg">
          <h2 className="text-sm font-bold uppercase">Lista de Avisos Hidrológicos</h2>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Buscar:</span>
            <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Zonal, estación, título..." className="border border-slate-300 rounded px-3 py-1 text-sm w-64" />
          </div>
          <span className="text-sm text-slate-500">{filtered.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#00539b] text-white text-center">
              <tr>
                <th className="p-2.5 font-semibold">Dirección Zonal</th>
                <th className="p-2.5 font-semibold">Estación</th>
                <th className="p-2.5 font-semibold">Aviso</th>
                <th className="p-2.5 font-semibold">Nro.</th>
                <th className="p-2.5 font-semibold">Fecha Inicio</th>
                <th className="p-2.5 font-semibold">Fecha Final</th>
                <th className="p-2.5 font-semibold">Duración</th>
                <th className="p-2.5 font-semibold">Nivel</th>
                <th className="p-2.5 font-semibold">Usuario</th>
                <th className="p-2.5 font-semibold">Estado</th>
                <th className="p-2.5 font-semibold" colSpan={2}>Acciones</th>
              </tr>
              <tr className="bg-[#0070ba]">
                <th colSpan={10}></th>
                <th className="p-1.5 font-normal text-xs">Mas Información</th>
                <th className="p-1.5 font-normal text-xs">Habilitar / Deshabilitar</th>
              </tr>
            </thead>
            <tbody className="text-center">
              {filtered.map((a) => {
                const st = stationMap[a.stationId];
                return (
                  <tr key={`${a.ca}-${a.ce}`} className={`border-t border-slate-200 ${a.vigente ? "bg-red-50/40 hover:bg-red-100/60" : "hover:bg-slate-50"}`}>
                    <td className="p-2 text-xs">{st?.dz ?? "—"}</td>
                    <td className="p-2 font-semibold text-xs">{st?.estacion ?? a.stationId}</td>
                    <td className={`p-2 text-xs text-left max-w-[200px] ${a.vigente ? "font-bold text-[#dc2626]" : ""}`}>{a.titulo}</td>
                    <td className={`p-2 font-semibold ${a.vigente ? "text-[#dc2626]" : ""}`}>{a.nro}</td>
                    <td className="p-2 text-xs">{a.inicio}</td>
                    <td className="p-2 text-xs">{a.fin}</td>
                    <td className="p-2 text-xs">{a.duracionHoras} horas</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${badgeNivel[a.nivel]}`}>{a.nivel}</span>
                    </td>
                    <td className="p-2 text-xs">{USUARIO.usuario}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.vigente ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                        {a.vigente ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-2">
                      <a href={`/avisos/${a.ca}-${a.ce}`} className="inline-flex items-center justify-center w-8 h-8 rounded bg-[#00539b] text-white hover:bg-[#0070ba]" title="Mas Información">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </a>
                    </td>
                    <td className="p-2">
                      <button onClick={() => toggleVigente(a)} className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-200 text-slate-600 hover:bg-slate-300" title={a.vigente ? "Deshabilitar" : "Habilitar"}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {a.vigente
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />}
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
  );
}
