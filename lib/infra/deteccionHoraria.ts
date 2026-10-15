import type { Alert } from "@/lib/domain/types";
import { detectarAvisos } from "@/lib/domain/deteccion";
import { esPublicado, procesarDeteccion } from "@/lib/domain/avisos";
import { getLatestMerged, getMockNow, getSeriesMerged, loadAlerts, saveAlerts } from "@/lib/infra/data";
import { getStationsConfig } from "@/lib/infra/stationConfig";
import { getUmbralesActivos } from "@/lib/infra/umbrales";

// ── Job horario simulado (flujo Bizagi: "Consultar el dato de la última hora") ──
// En el PoC no hay backend: la primera lectura de avisos de cada hora de datos
// (reloj del mock) ejecuta detección + publicación y guarda la hora procesada.
// En producción se reemplaza por un scheduler o por la ingesta de observaciones.

const KEY = "senamhi_deteccion_hora";

export interface ResultadoDeteccion {
  alerts: Alert[];
  textos: string[];
  hora: string;
}

export function ultimaHoraProcesada(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Olvida la hora procesada: la próxima lectura vuelve a ejecutar la detección.
export function reiniciarDeteccion() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

// Ejecuta ahora (Pool 1 + publicación) y marca la hora como procesada.
export function ejecutarDeteccion(): ResultadoDeteccion {
  const hora = getMockNow();
  const stations = getStationsConfig();
  const latest = getLatestMerged();
  const det = detectarAvisos(stations, latest, getUmbralesActivos, hora);
  const { next, textos } = procesarDeteccion(loadAlerts(), det, {
    stations,
    latest,
    umbralesDe: getUmbralesActivos,
    serieDe: (id) => getSeriesMerged(id),
    mockNow: hora,
  });
  if (textos.length > 0) saveAlerts(next);
  localStorage.setItem(KEY, hora);
  return { alerts: next, textos, hora };
}

// Ejecuta solo si la hora de datos actual todavía no fue procesada.
export function detectarSiCorresponde(): ResultadoDeteccion | null {
  if (typeof window === "undefined") return null;
  const hora = getMockNow();
  if (!hora || ultimaHoraProcesada() === hora) return null;
  return ejecutarDeteccion();
}

// Avisos al día: lo que deben usar las vistas en vez de `loadAlerts`.
export function avisosActualizados(): Alert[] {
  return detectarSiCorresponde()?.alerts ?? loadAlerts();
}

// Vista pública: sin pendientes de aprobación ni descartados.
export function avisosPublicadosActualizados(): Alert[] {
  return avisosActualizados().filter(esPublicado);
}
