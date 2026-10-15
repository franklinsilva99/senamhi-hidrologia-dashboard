"use client";
import { useState, useEffect } from "react";
import { getAlerts, loadAlerts, saveAlerts, getLatestMerged, getSeriesMerged, getMockNow } from "@/lib/infra/data";
import { getStationsConfig } from "@/lib/infra/stationConfig";
import { detectarAvisos } from "@/lib/domain/deteccion";
import { getUmbralesActivos } from "@/lib/infra/umbrales";
import { detectarSiCorresponde, ejecutarDeteccion, reiniciarDeteccion, ultimaHoraProcesada } from "@/lib/infra/deteccionHoraria";
import { esPublicado, estaVencido, venceEn, existeAvisoPrevio, avisoPendiente, crearAviso, evaluarAccionAviso, siguienteNro, siguienteCA, aplicarAviso, aprobarAviso, descartarAviso } from "@/lib/domain/avisos";
import type { Alert, DeteccionAviso, Station } from "@/lib/domain/types";
import { unidadMostrada } from "@/lib/domain/unidades";
import { USUARIO } from "@/lib/sesion";
import ChartAviso from "@/components/ChartAviso";

const badgeNivel: Record<string, string> = {
  AMARILLO: "bg-[#ffeb3b] text-black",
  NARANJA: "bg-[#fca326] text-white",
  ROJO: "bg-[#ee3d43] text-white",
};

export default function AdminAvisosPage() {
  const [alerts, setAlerts] = useState<Alert[]>(getAlerts);
  // Filtros de la lista (una sola barra): texto libre, DZ y periodo.
  const [filtroDZ, setFiltroDZ] = useState("");
  const [periodoDesde, setPeriodoDesde] = useState("");
  const [periodoHasta, setPeriodoHasta] = useState("");
  const [searchText, setSearchText] = useState("");
  const [previewAviso, setPreviewAviso] = useState<Alert | null>(null);

  // ── Estado ──
  const [deteccion, setDeteccion] = useState<DeteccionAviso[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [msg, setMsg] = useState("");
  const [horaProcesada, setHoraProcesada] = useState<string | null>(null);

  useEffect(() => {
    // Job horario simulado: si la hora de datos actual no se procesó, se ejecuta ahora.
    const job = detectarSiCorresponde();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setAlerts(job?.alerts ?? loadAlerts());
    setStations(getStationsConfig());
    setDeteccion(detectarAvisos(getStationsConfig(), getLatestMerged(), getUmbralesActivos, getMockNow()));
    setHoraProcesada(ultimaHoraProcesada());
    if (job && job.textos.length > 0) setMsg(`Detección horaria (${job.hora.replace("T", " ")}): ${job.textos.join(" ")}`);
  }, []);

  const stationMap = Object.fromEntries(stations.map((s) => [s.id, s]));
  const dzList = [...new Set(stations.map((s) => s.dz).filter(Boolean))];
  // Última lectura por estación, de la serie fusionada (caudal + nivel).
  const latestOverride = getLatestMerged();

  const filtered = alerts.filter((a) => {
    const st = stationMap[a.stationId];
    if (filtroDZ && st?.dz !== filtroDZ) return false;
    // Periodo: avisos vigentes en algún momento del rango (se solapan con él).
    if (periodoHasta && a.inicio > periodoHasta) return false;
    if (periodoDesde && a.fin < periodoDesde) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (
        !a.titulo.toLowerCase().includes(q) &&
        !a.nro.toString().includes(q) &&
        !(st?.estacion ?? "").toLowerCase().includes(q) &&
        !(st?.rio ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }).sort((a, b) => {
    const pa = a.estado === "pendiente", pb = b.estado === "pendiente";
    if (pa !== pb) return pa ? -1 : 1;
    if (a.vigente !== b.vigente) return a.vigente ? -1 : 1;
    return b.inicio.localeCompare(a.inicio) || b.nro - a.nro;
  });

  const estacionesConAlerta = deteccion.filter((d) => d.excedido);
  const ahora = getMockNow();
  // Estaciones cuyo último dato ya no supera umbral (para marcar "río normalizado").
  const rioNormal = new Set(deteccion.filter((d) => !d.excedido).map((d) => d.stationId));

  // ── Forzar detección (p. ej. tras cambiar umbrales o modo de publicación) ──
  const handleActualizarDeteccion = () => {
    const { alerts: next, textos, hora } = ejecutarDeteccion();
    setAlerts(next);
    setDeteccion(detectarAvisos(getStationsConfig(), latestOverride, getUmbralesActivos, getMockNow()));
    setHoraProcesada(hora);
    setMsg(textos.length > 0 ? `Detección procesada: ${textos.join(" ")}` : "Detección procesada: sin cambios.");
    setTimeout(() => setMsg(""), 6000);
  };

  const handleCrearAviso = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    if (!station) return;
    const preferencia = station.preferencia ?? "caudal";
    const aviso = crearAviso({
      station,
      latest: latestOverride,
      activos: getUmbralesActivos(stationId, preferencia, getMockNow()),
      preferencia,
      mockNow: getMockNow(),
      serie: getSeriesMerged(stationId),
      nro: siguienteNro(alerts),
      ca: siguienteCA(alerts),
    });
    setPreviewAviso(aviso);
  };

  // Publicar el aviso del preview: si es un pendiente (modo manual) se aprueba.
  const handlePublicar = () => {
    if (!previewAviso) return;
    const { next, texto } =
      previewAviso.estado === "pendiente" ? aprobarAviso(alerts, previewAviso) : aplicarAviso(alerts, previewAviso);
    setAlerts(next);
    saveAlerts(next);
    setPreviewAviso(null);
    setDeteccion(detectarAvisos(stations, latestOverride, getUmbralesActivos, getMockNow()));
    setMsg(texto);
    setTimeout(() => setMsg(""), 5000);
  };

  const handleDescartar = () => {
    if (!previewAviso) return;
    const { next, texto } = descartarAviso(alerts, previewAviso);
    setAlerts(next);
    saveAlerts(next);
    setPreviewAviso(null);
    setMsg(texto);
    setTimeout(() => setMsg(""), 5000);
  };

  const handleLimpiarDatos = () => {
    const originales = getAlerts();
    setAlerts(originales);
    saveAlerts(originales);
    // La próxima carga vuelve a correr la detección horaria sobre los avisos base.
    reiniciarDeteccion();
    setHoraProcesada(null);
    setMsg(`Datos restaurados a los ${originales.length} avisos base. La detección horaria se ejecutará en la próxima carga.`);
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
    ? evaluarAccionAviso(previewAviso.stationId, previewAviso.nivel, previewAviso.tipo, alerts)
    : null;
  const previewEstado = previewAviso?.estado ?? "publicado";
  // Un aviso ya publicado o descartado se abre solo para consulta.
  const previewGuardado = previewAviso
    ? alerts.some((a) => a.ca === previewAviso.ca && a.ce === previewAviso.ce)
    : false;
  const previoDePreview = previewAviso ? existeAvisoPrevio(previewAviso.stationId, alerts) : null;

  return (
    <div className="space-y-5">
      {/* ── SECCIÓN 1: Detección Automática ── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-card">
        <div className="bg-primary-500 text-white px-4 py-2 rounded-t-lg flex items-center justify-between gap-3">
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
                    const pendiente = avisoPendiente(d.stationId, alerts);
                    const accion = evaluarAccionAviso(d.stationId, d.umbral ?? "", d.tipo, alerts);
                    const valorMostrar = d.valorAbsoluto ?? d.valorActual;
                    const unidadMostrar = unidadMostrada(d.preferencia, st?.cota);
                    return (
                      <tr key={d.stationId} className="border-t hover:bg-slate-50">
                        <td className="p-2 font-semibold">{st?.estacion ?? d.stationId}</td>
                        <td className="p-2 text-xs">{st?.rio}</td>
                        <td className="p-2 text-xs">{st?.dz ?? "—"}</td>
                        <td className="p-2 text-xs">{d.preferencia}</td>
                        <td className="p-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded ${d.tipo === "vaciante" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"}`}>{d.tipo}</span>
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
                              #{previo.nro} ({previo.tipo} · {previo.nivel}) {accion === "reemplazar" ? "→ reemplazar" : "= sin cambios"}
                            </span>
                          ) : (
                            <span className="text-green-600">Sin previo</span>
                          )}
                          {pendiente && (
                            <span className="block text-amber-700 font-semibold">
                              #{pendiente.nro} pendiente de aprobación ({pendiente.nivel})
                            </span>
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
                            {pendiente && accion !== "mantener" ? (
                              <button
                                onClick={() => setPreviewAviso(pendiente)}
                                className="px-3 py-1 rounded text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600"
                                title="Revisar el aviso pendiente y aprobarlo o descartarlo"
                              >
                                Revisar pendiente
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCrearAviso(d.stationId)}
                                disabled={accion === "mantener"}
                                className={`px-3 py-1 rounded text-xs font-semibold ${accion === "mantener" ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-primary-500 text-white hover:bg-primary-600"}`}
                                title={accion === "mantener" ? "El aviso vigente ya tiene el mismo tipo y nivel" : "Crear aviso"}
                              >
                                {accion === "mantener" ? "Sin cambios" : accion === "reemplazar" ? "Reemplazar" : "Crear aviso"}
                              </button>
                            )}
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
              className="text-xs text-primary-500 hover:underline font-semibold"
            >
              ↻ Forzar detección ahora
            </button>
            <span className="text-xs text-slate-400" title="La detección corre sola una vez por cada hora de datos nueva">
              Detección horaria: {horaProcesada ? `procesada ${horaProcesada.replace("T", " ")}` : "pendiente"}
            </span>
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
                <span className={`px-2 py-1 rounded text-xs font-semibold ${previewAviso.tipo === "vaciante" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700"}`}>{previewAviso.tipo}</span>
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
            {previewEstado === "pendiente" && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Pendiente de aprobación (publicación manual). No es público todavía.
                {previoDePreview && ` Al aprobarlo se desactiva el aviso vigente #${previoDePreview.nro} (${previoDePreview.nivel}).`}
              </p>
            )}
            {previewEstado === "publicado" && !previewGuardado && accionPreview === "mantener" && (
              <p className="text-sm text-slate-500 text-center">
                Sin cambios: la estación ya tiene un aviso vigente de este tipo y nivel.
              </p>
            )}
            {(() => {
              // Solo se puede actuar sobre un pendiente o un aviso nuevo que cambia algo.
              const puedeActuar =
                previewEstado === "pendiente" || (!previewGuardado && accionPreview !== "mantener");
              return (
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setPreviewAviso(null)} className="px-4 py-2 rounded border text-sm hover:bg-slate-50">
                    {puedeActuar ? "Cancelar" : "Cerrar"}
                  </button>
                  {previewEstado === "pendiente" && (
                    <button onClick={handleDescartar} className="px-4 py-2 rounded border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50">
                      Descartar
                    </button>
                  )}
                  {puedeActuar && (
                    <button onClick={handlePublicar} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700">
                      {previewEstado === "pendiente" ? "Aprobar y publicar" : "Publicar"}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Mensaje de éxito ── */}
      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm font-semibold">
          ✓ {msg}
        </div>
      )}

      {/* ── SECCIÓN 2: Lista de avisos (con su barra de filtros) ── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-card">
        <div className="bg-primary-500 text-white px-4 py-2 rounded-t-lg">
          <h2 className="text-sm font-bold uppercase">Lista de Avisos Hidrológicos</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-slate-200">
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Estación, río, título o Nro…"
            aria-label="Buscar avisos"
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-64"
          />
          <select
            value={filtroDZ}
            onChange={(e) => setFiltroDZ(e.target.value)}
            aria-label="Dirección Zonal"
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas las DZ</option>
            {dzList.map((dz) => <option key={dz} value={dz!}>{dz}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-sm text-slate-500" title="Avisos vigentes en algún momento del periodo">
            <span>Periodo</span>
            <input type="date" value={periodoDesde} max={periodoHasta || undefined} onChange={(e) => setPeriodoDesde(e.target.value)} aria-label="Periodo desde" className="border border-slate-300 rounded px-2 py-1 text-sm" />
            <span>–</span>
            <input type="date" value={periodoHasta} min={periodoDesde || undefined} onChange={(e) => setPeriodoHasta(e.target.value)} aria-label="Periodo hasta" className="border border-slate-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {(searchText || filtroDZ || periodoDesde || periodoHasta) && (
              <button
                onClick={() => { setSearchText(""); setFiltroDZ(""); setPeriodoDesde(""); setPeriodoHasta(""); }}
                className="text-primary-500 font-semibold hover:underline"
              >
                Limpiar filtros
              </button>
            )}
            <span className="text-slate-500">{filtered.length} registros</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-500 text-white text-center">
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
              <tr className="bg-primary-600">
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
                      {a.estado === "pendiente" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white">Pendiente</span>
                      ) : a.estado === "descartado" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-400 line-through">Descartado</span>
                      ) : !a.vigente && estaVencido(a, ahora) ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-500" title={`Venció el ${venceEn(a).replace("T", " ")}`}>
                          Vencido
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.vigente ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                          {a.vigente ? "Activo" : "Inactivo"}
                        </span>
                      )}
                      {a.vigente && rioNormal.has(a.stationId) && (
                        <span
                          className="mt-1 block text-[10px] font-semibold text-sky-700"
                          title={`El último dato ya no supera umbral. Puede deshabilitarlo o dejar que venza el ${venceEn(a).replace("T", " ")}.`}
                        >
                          Río normalizado
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {esPublicado(a) ? (
                        <a href={`/avisos/${a.ca}-${a.ce}`} className="inline-flex items-center justify-center w-8 h-8 rounded bg-primary-500 text-white hover:bg-primary-600" title="Mas Información">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </a>
                      ) : (
                        <button onClick={() => setPreviewAviso(a)} className={`inline-flex items-center justify-center w-8 h-8 rounded text-white ${a.estado === "pendiente" ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-400 hover:bg-slate-500"}`} title={a.estado === "pendiente" ? "Revisar y aprobar" : "Ver aviso descartado"}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                      )}
                    </td>
                    <td className="p-2">
                      <button onClick={() => toggleVigente(a)} disabled={!esPublicado(a) || (!a.vigente && estaVencido(a, ahora))} className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed" title={!esPublicado(a) ? "Solo para avisos publicados" : !a.vigente && estaVencido(a, ahora) ? "Aviso vencido" : a.vigente ? "Deshabilitar" : "Habilitar"}>
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
