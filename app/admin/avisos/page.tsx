"use client";
import { useState, useMemo, useEffect } from "react";
import { getAlerts, getStations, loadAlerts, saveAlerts, loadInjectedObs, appendInjectedObs, clearInjectedObs, getLatestMerged, getSeriesMerged } from "@/lib/data";
import { detectarAvisos, prepararAviso } from "@/lib/queries";
import { getConfigThresholdsMap } from "@/lib/configEstacion";
import { existeAvisoPrevio, crearAviso, evaluarAccionAviso, siguienteNro, siguienteCA } from "@/lib/avisos";
import type { Alert, DeteccionAviso, NivelAlerta, Observation, TipoAviso } from "@/lib/types";

const badgeNivel: Record<string, string> = {
  AMARILLO: "bg-[#ffeb3b] text-black",
  NARANJA: "bg-[#fca326] text-white",
  ROJO: "bg-[#ee3d43] text-white",
};

const MODO_KEY = "senamhi_modo_publicacion";
type ModoPublicacion = "automatico" | "manual";

function clasificarValor(valor: number, u: { amarilla: number; naranja: number; roja: number }, tipo: TipoAviso): NivelAlerta | null {
  if (tipo === "vigilancia") {
    if (valor <= u.roja) return "ROJO";
    if (valor <= u.naranja) return "NARANJA";
    if (valor <= u.amarilla) return "AMARILLO";
    return null;
  }
  if (valor >= u.roja) return "ROJO";
  if (valor >= u.naranja) return "NARANJA";
  if (valor >= u.amarilla) return "AMARILLO";
  return null;
}

export default function AdminAvisosPage() {
  const [alerts, setAlerts] = useState<Alert[]>(getAlerts);
  const [filtroDZ, setFiltroDZ] = useState("");
  const [filtroStation, setFiltroStation] = useState("");
  const [filtroFechaIni, setFiltroFechaIni] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [searchText, setSearchText] = useState("");
  const [previewAviso, setPreviewAviso] = useState<Alert | null>(null);

  // ── Simulación ──
  const [simStationId, setSimStationId] = useState("socsi");
  const [simVariable, setSimVariable] = useState<"caudal" | "nivel">("caudal");
  const [simValor, setSimValor] = useState("");
  const [simMsg, setSimMsg] = useState("");
  const [injectedObs, setInjectedObs] = useState<Record<string, Observation>>({});
  const [deteccion, setDeteccion] = useState<DeteccionAviso[]>(() => detectarAvisos());
  const [msg, setMsg] = useState("");
  const [preferenciaOverride, setPreferenciaOverride] = useState<Record<string, "caudal" | "nivel">>({});
  const [modoPublicacion, setModoPublicacion] = useState<ModoPublicacion>("automatico");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setAlerts(loadAlerts());
    // Cargar la ingesta persistida (overlay) en el estado para reactividad
    const all = loadInjectedObs();
    const last: Record<string, Observation> = {};
    for (const o of all) last[o.stationId] = o;
    setInjectedObs(last);
    setRefresh((r) => r + 1);
    setDeteccion(detectarAvisos(undefined, undefined, getConfigThresholdsMap()));
  }, []);

  useEffect(() => {
    const m = localStorage.getItem(MODO_KEY);
    if (m === "manual" || m === "automatico") setModoPublicacion(m);
  }, []);

  const cambiarModo = (m: ModoPublicacion) => {
    setModoPublicacion(m);
    localStorage.setItem(MODO_KEY, m);
  };

  const stations = getStations();
  const stationMap = Object.fromEntries(stations.map((s) => [s.id, s]));
  // Umbrales/alertas con overrides de configuración (localStorage)
  const thMap = useMemo(() => getConfigThresholdsMap(), [refresh]);
  const dzList = [...new Set(stations.map((s) => s.dz).filter(Boolean))];
  // Última lectura válida (qc1-ok) por estación, de la serie fusionada (estática + overlay)
  const latestOverride = useMemo(() => getLatestMerged(), [refresh]);

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

  // ── Ingesta de observación (simula el sensor) ──
  const handleInyectar = () => {
    const valor = parseFloat(simValor);
    if (isNaN(valor) || valor <= 0) {
      setSimMsg("Ingrese un valor válido (> 0)");
      return;
    }
    const th = thMap[simStationId];

    // Próxima hora respecto al fin de la serie (reloj del mock)
    const serie = getSeriesMerged(simStationId);
    const prev = serie.length > 0 ? serie[serie.length - 1] : null;
    const baseFecha = prev ? prev.fecha : new Date().toISOString().slice(0, 16);
    const next = new Date(baseFecha.replace(" ", "T"));
    next.setHours(next.getHours() + 1);
    const fecha = next.toISOString().slice(0, 16);

    let caudal: number;
    let nivel: number;
    if (simVariable === "caudal") {
      caudal = valor;
      nivel = Math.round((valor / (th?.caudal.amarilla ?? 42)) * 1.5 * 100) / 100;
    } else {
      nivel = valor;
      caudal = Math.round((valor / (th?.nivel.amarilla ?? 1.95)) * (th?.caudal.amarilla ?? 42) * 100) / 100;
    }

    // QC1: rango y salto máximo respecto a la lectura previa
    const qc = th?.qc1 ?? { min: 0, max: Number.POSITIVE_INFINITY, deltaMax: Number.POSITIVE_INFINITY };
    const delta = prev ? Math.abs(caudal - prev.caudal) : 0;
    const fallaQC = caudal > qc.max || caudal < qc.min || delta > qc.deltaMax;
    const origen = fallaQC ? ("cuarentena" as const) : ("qc1-ok" as const);

    const tipoEst = th?.tipo ?? "avenida";
    const nivelDet = clasificarValor(nivel, th?.nivel ?? { amarilla: 1.95, naranja: 3.06, roja: 4.42 }, tipoEst);
    const estado = nivelDet === "ROJO" ? "roja" as const : nivelDet === "NARANJA" ? "naranja" as const : nivelDet === "AMARILLO" ? "amarilla" as const : "normal" as const;

    const obs: Observation = { stationId: simStationId, fecha, nivel, caudal, origen, estado };

    appendInjectedObs(obs);
    setInjectedObs((p) => ({ ...p, [simStationId]: obs }));
    if (simVariable === "nivel") {
      setPreferenciaOverride((p) => ({ ...p, [simStationId]: "nivel" }));
    }
    setRefresh((r) => r + 1);

    const st = stationMap[simStationId];
    const unidad = simVariable === "caudal" ? "m³/s" : "m";
    const qcTxt = fallaQC ? "⚠ cuarentena (no dispara aviso)" : "✓ qc1-ok";
    setSimMsg(`Ingesta: ${st?.estacion} — ${valor} ${unidad} @ ${fecha} · ${qcTxt}. Clic en "Actualizar detección".`);
    setTimeout(() => setSimMsg(""), 7000);
  };

  // ── Aplicar aviso respetando compuertas BPMN (desactivación condicional) ──
  const aplicarAviso = (base: Alert[], aviso: Alert): { next: Alert[]; texto: string } => {
    const accion = evaluarAccionAviso(aviso.stationId, aviso.nivel, base);
    if (accion === "mantener") {
      return { next: base, texto: `Sin cambios: la estación ya tiene un aviso vigente en nivel ${aviso.nivel}.` };
    }
    if (accion === "reemplazar") {
      const previo = existeAvisoPrevio(aviso.stationId, base);
      const next = base
        .map((a) => (a.stationId === aviso.stationId && a.vigente ? { ...a, vigente: false } : a))
        .concat(aviso);
      return { next, texto: `Aviso #${previo?.nro} desactivado. Nuevo aviso #${aviso.nro} publicado (${aviso.nivel}).` };
    }
    return { next: base.concat(aviso), texto: `Aviso #${aviso.nro} publicado correctamente (${aviso.nivel}).` };
  };

  // ── Publicación automática (rama BPMN "¿La publicación es automática? = SI") ──
  const publicarAutomatico = (base: Alert[], det: DeteccionAviso[]): { next: Alert[]; textos: string[] } => {
    let next = base;
    const textos: string[] = [];
    for (const d of det) {
      if (!d.excedido || !d.umbral) continue;
      if (evaluarAccionAviso(d.stationId, d.umbral, next) === "mantener") continue;
      const aviso = crearAviso(d.stationId, latestOverride, preferenciaOverride, { nro: siguienteNro(next), ca: siguienteCA(next) }, thMap);
      const res = aplicarAviso(next, aviso);
      next = res.next;
      textos.push(res.texto);
    }
    return { next, textos };
  };

  // ── Actualizar detección ──
  const handleActualizarDeteccion = () => {
    const det = detectarAvisos(latestOverride, preferenciaOverride, thMap);
    setDeteccion(det);
    if (modoPublicacion === "automatico") {
      const { next, textos } = publicarAutomatico(alerts, det);
      if (textos.length > 0) {
        setAlerts(next);
        saveAlerts(next);
        setMsg(`Publicación automática: ${textos.join(" ")}`);
        setTimeout(() => setMsg(""), 6000);
      }
    }
  };

  const handleCrearAviso = (stationId: string) => {
    const aviso = crearAviso(stationId, latestOverride, preferenciaOverride, { nro: siguienteNro(alerts), ca: siguienteCA(alerts) }, thMap);
    setPreviewAviso(aviso);
  };

  const handlePublicar = () => {
    if (!previewAviso) return;
    const { next, texto } = aplicarAviso(alerts, previewAviso);
    setAlerts(next);
    saveAlerts(next);
    setPreviewAviso(null);
    setDeteccion(detectarAvisos(latestOverride, preferenciaOverride, thMap));
    setMsg(texto);
    setTimeout(() => setMsg(""), 5000);
  };

  const handleLimpiarInyeccion = () => {
    clearInjectedObs();
    setInjectedObs({});
    setPreferenciaOverride({});
    setRefresh((r) => r + 1);
    setDeteccion(detectarAvisos(undefined, undefined, getConfigThresholdsMap()));
    setSimMsg("Ingesta limpiada. Detección restaurada a la serie base.");
    setTimeout(() => setSimMsg(""), 4000);
  };

  const handleLimpiarDatos = () => {
    const originales = getAlerts();
    setAlerts(originales);
    saveAlerts(originales);
    setMsg(`Datos restaurados a los ${originales.length} avisos base.`);
    setTimeout(() => setMsg(""), 4000);
  };

  const simTh = thMap[simStationId];
  const simValorActual = simValor ? parseFloat(simValor) : 0;
  const simUmbrales = simVariable === "caudal" ? simTh?.caudal : simTh?.nivel;
  const simUmbralRef = simUmbrales?.amarilla;
  const simNivelDetectado = simTh && simValorActual > 0 && simUmbrales
    ? clasificarValor(simValorActual, simUmbrales, simTh.tipo)
    : null;
  const simExcedido = simNivelDetectado !== null;

  return (
    <div className="space-y-5">
      {/* ── SECCIÓN 0: Simulación de Observación ── */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="bg-amber-600 text-white px-4 py-2 rounded-t-lg flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Simulación de Observación
          </h2>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded">Solo para pruebas</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-3">
              <label className="block text-xs text-slate-500 mb-1 uppercase">Estación</label>
              <select value={simStationId} onChange={(e) => setSimStationId(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                {stations.map((s) => <option key={s.id} value={s.id}>{s.estacion} ({s.rio})</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1 uppercase">Variable</label>
              <select value={simVariable} onChange={(e) => setSimVariable(e.target.value as "caudal" | "nivel")} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                <option value="caudal">Caudal (m³/s)</option>
                <option value="nivel">Nivel (m)</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-xs text-slate-500 mb-1 uppercase">
                Valor {simVariable === "caudal" ? "(m³/s)" : "(m)"} {simUmbralRef !== undefined && (
                  <span className="text-slate-400 normal-case">— Amarilla: {simUmbralRef} {simVariable === "caudal" ? "m³/s" : "m"}</span>
                )}
              </label>
              <input
                type="number"
                step="any"
                value={simValor}
                onChange={(e) => setSimValor(e.target.value)}
                placeholder={simTh ? (simVariable === "caudal" ? `Ej: ${simTh.caudal.amarilla + 5}` : `Ej: ${simTh.nivel.amarilla + 0.5}`) : ""}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              {simValorActual > 0 && (
                <div className={`text-xs font-bold px-2 py-1 rounded text-center ${simExcedido ? badgeNivel[simNivelDetectado!] : "bg-green-100 text-green-700"}`}>
                  {simExcedido ? `⚠ ${simNivelDetectado}` : "✓ Normal"}
                </div>
              )}
            </div>
            <div className="col-span-1">
              <button onClick={handleInyectar} className="w-full bg-amber-600 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-amber-700">
                Inyectar
              </button>
            </div>
            <div className="col-span-1">
              <button onClick={handleLimpiarInyeccion} className="w-full bg-slate-200 text-slate-600 px-3 py-2 rounded text-sm hover:bg-slate-300">
                Limpiar
              </button>
            </div>
          </div>
          {simMsg && (
            <div className="mt-2 text-xs px-3 py-2 rounded bg-amber-50 text-amber-800 border border-amber-200">
              {simMsg}
            </div>
          )}
          {Object.keys(injectedObs).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(injectedObs).map(([sid, obs]) => {
                const st = stationMap[sid];
                const th = thMap[sid];
                const pref = preferenciaOverride[sid] ?? th?.preferencia ?? "caudal";
                const tipo = th?.tipo ?? "avenida";
                const umbrales = pref === "caudal" ? th?.caudal : th?.nivel;
                const valor = pref === "caudal" ? obs.caudal : obs.nivel;
                const valorMsnm = pref === "nivel" && st?.cota != null ? obs.nivel + st.cota : valor;
                const unidad = pref === "caudal" ? "m³/s" : "m.s.n.m.";
                const nivelDet = umbrales ? clasificarValor(valor, umbrales, tipo) : null;
                return (
                  <span key={sid} className={`text-xs px-2 py-1 rounded ${nivelDet ? "bg-red-100 text-red-700 border border-red-200" : "bg-green-100 text-green-700 border border-green-200"}`}>
                    {st?.estacion}: {valorMsnm.toFixed(2)} {unidad} {nivelDet ? `⚠ ${nivelDet}` : "✓"}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN 1: Detección Automática ── */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="bg-[#00539b] text-white px-4 py-2 rounded-t-lg flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase">Detección Automática de Avisos</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 uppercase">Publicación</span>
            <div className="inline-flex rounded overflow-hidden border border-white/30">
              <button
                onClick={() => cambiarModo("automatico")}
                className={`px-2.5 py-1 text-xs font-semibold ${modoPublicacion === "automatico" ? "bg-white text-[#00539b]" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                Automática
              </button>
              <button
                onClick={() => cambiarModo("manual")}
                className={`px-2.5 py-1 text-xs font-semibold ${modoPublicacion === "manual" ? "bg-white text-[#00539b]" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                Manual
              </button>
            </div>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{estacionesConAlerta.length} estación(es) con alerta</span>
          </div>
        </div>
        <div className="p-4">
          {estacionesConAlerta.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Ninguna estación supera umbrales en este momento. Use la sección de simulación para inyectar un caudal.
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
                          <button
                            onClick={() => handleCrearAviso(d.stationId)}
                            disabled={accion === "mantener"}
                            className={`px-3 py-1 rounded text-xs font-semibold ${accion === "mantener" ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-[#00539b] text-white hover:bg-[#0070ba]"}`}
                            title={accion === "mantener" ? "El aviso vigente ya tiene el mismo nivel" : "Crear aviso"}
                          >
                            {accion === "mantener" ? "Sin cambios" : accion === "reemplazar" ? "Reemplazar" : "Crear aviso"}
                          </button>
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
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
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPreviewAviso(null)} className="px-4 py-2 rounded border text-sm hover:bg-slate-50">Cancelar</button>
              <button onClick={handlePublicar} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700">Publicar</button>
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
                <th className="p-2.5 font-semibold" colSpan={5}>Acciones</th>
              </tr>
              <tr className="bg-[#0070ba]">
                <th colSpan={10}></th>
                <th className="p-1.5 font-normal text-xs">Mas Información</th>
                <th className="p-1.5 font-normal text-xs">Habilitar / Deshabilitar</th>
                <th className="p-1.5 font-normal text-xs">Visualizar / Ocultar</th>
                <th className="p-1.5 font-normal text-xs">Actualizar Información</th>
                <th className="p-1.5 font-normal text-xs">Actualizar Datos</th>
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
                    <td className="p-2 text-xs">MCASAVERDE</td>
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
                      <button className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-200 text-slate-600 hover:bg-slate-300" title={a.vigente ? "Deshabilitar" : "Habilitar"}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {a.vigente
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />}
                        </svg>
                      </button>
                    </td>
                    <td className="p-2">
                      <button className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-200 text-slate-600 hover:bg-slate-300" title="Visualizar / Ocultar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    </td>
                    <td className="p-2">
                      <button className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-200 text-slate-600 hover:bg-slate-300" title="Actualizar Información">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    </td>
                    <td className="p-2">
                      <button className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-200 text-slate-600 hover:bg-slate-300" title="Actualizar Datos">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
