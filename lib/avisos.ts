import { detectarAvisos, prepararAviso, getThresholds } from "./queries";
import { getAlerts, getStations, getLatestMerged, getMockNow, getSeriesMerged } from "./data";
import type { Alert, DeteccionAviso, Observation, Thresholds } from "./types";

// Pool 1: Listar avisos que superan umbrales
export function listarAvisosDetectados(latestOverride?: Record<string, Observation>, preferenciaOverride?: Record<string, "caudal" | "nivel">, thresholdsOverride?: Record<string, Thresholds>): DeteccionAviso[] {
  return detectarAvisos(latestOverride, preferenciaOverride, thresholdsOverride).filter((d) => d.excedido);
}

// Pool 1: ¿Existe aviso previo vigente en esa estación? (sobre la colección de trabajo)
export function existeAvisoPrevio(stationId: string, alerts: Alert[]): Alert | null {
  return alerts.find((a) => a.stationId === stationId && a.vigente) ?? null;
}

// Pool 1: ¿El nivel del aviso vigente es diferente al nuevo?
export function nivelEsDiferente(stationId: string, nuevoNivel: string, alerts: Alert[]): boolean {
  const previo = existeAvisoPrevio(stationId, alerts);
  if (!previo) return true;
  return previo.nivel !== nuevoNivel;
}

export type AccionAviso = "mantener" | "crear" | "reemplazar";

// Secuencia global de avisos: máximo + 1 (nro) y máximo + 1 (ca)
export function siguienteNro(alerts: Alert[]): number {
  return Math.max(0, ...alerts.map((a) => a.nro)) + 1;
}

export function siguienteCA(alerts: Alert[]): string {
  const max = Math.max(0, ...alerts.map((a) => Number(a.ca) || 0));
  return String(max + 1);
}

// Pool 1 (compuertas BPMN): ¿nivel del aviso vigente es diferente? → ¿existe aviso previo?
//   - sin aviso previo              → "crear"
//   - con previo y mismo nivel      → "mantener"   (no se hace nada)
//   - con previo y distinto nivel   → "reemplazar" (desactivar anterior + crear)
export function evaluarAccionAviso(stationId: string, nuevoNivel: string, alerts: Alert[]): AccionAviso {
  const previo = existeAvisoPrevio(stationId, alerts);
  if (!previo) return "crear";
  return previo.nivel === nuevoNivel ? "mantener" : "reemplazar";
}

// Pool 2: Crear aviso completo (preparación + generación).
// Función pura: NO desactiva ni muta avisos previos; eso lo resuelve el orquestador.
export function crearAviso(
  stationId: string,
  latestOverride?: Record<string, Observation>,
  preferenciaOverride?: Record<string, "caudal" | "nivel">,
  secuencia?: { nro?: number; ca?: string },
  thresholdsOverride?: Record<string, Thresholds>,
): Alert {
  const preparacion = prepararAviso(stationId, latestOverride, preferenciaOverride, thresholdsOverride);
  const baseAlerts = getAlerts();
  const nro = secuencia?.nro ?? siguienteNro(baseAlerts);
  const ca = secuencia?.ca ?? siguienteCA(baseAlerts);
  const station = getStations().find((s) => s.id === stationId)!;
  const th = thresholdsOverride?.[stationId] ?? getThresholds().find((t) => t.stationId === stationId)!;
  const preferencia = preferenciaOverride?.[stationId] ?? th.preferencia;
  const baseLatest = getLatestMerged();
  const latest = latestOverride ? { ...baseLatest, ...latestOverride } : baseLatest;
  const latestObs = latest[stationId];

  const mockNow = getMockNow();
  const inicio = (mockNow || new Date().toISOString()).split("T")[0];

  const esNivel = preferencia === "nivel";
  const cota = station.cota ?? null;
  // Nivel absoluto (m.s.n.m.) = Nivel relativo + Cota
  const nivelActual = esNivel && cota !== null ? (latestObs?.nivel ?? 0) + cota : undefined;

  return {
    nro,
    ca,
    ce: station.codigoAuto ?? "00000000",
    stationId,
    titulo: preparacion.titulo,
    cuerpoAgua: preparacion.cuerpoAgua,
    distrito: preparacion.distrito,
    inicio,
    fin: preparacion.fin,
    duracionHoras: preparacion.duracionHoras,
    nivel: preparacion.nivel,
    plazo: preparacion.plazo,
    vigente: true,
    fechaEmision: preparacion.fechaEmision,
    descripcion: preparacion.descripcion,
    recomendaciones: preparacion.recomendaciones,
    validadoDZ: false,
    poblados: preparacion.poblados,
    caudalActual: esNivel ? undefined : latestObs?.caudal,
    nivelActual,
    preferencia,
    tipo: preparacion.tipo,
    cota,
    serie: getSeriesMerged(stationId),
  };
}
