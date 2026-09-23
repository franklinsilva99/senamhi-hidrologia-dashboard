import stations from "@/data/stations.json";
import observations from "@/data/observations_qc1.json";
import alerts from "@/data/alerts.json";
import type { Alert, Observation, Station } from "./types";

const STORAGE_KEY = "senamhi_avisos";
const OBS_KEY = "senamhi_observaciones";
const VENTANA_HORAS = 72;

export function getStations(): Station[] {
  return stations as Station[];
}

function staticSeries(stationId: string): Observation[] {
  return (observations as Observation[])
    .filter((o) => o.stationId === stationId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── Overlay de observaciones (ingesta simulada del sensor) ──
export function loadInjectedObs(): Observation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OBS_KEY);
    if (raw) return JSON.parse(raw) as Observation[];
  } catch { /* ignore */ }
  return [];
}

export function appendInjectedObs(obs: Observation) {
  if (typeof window === "undefined") return;
  const all = loadInjectedObs();
  all.push(obs);
  localStorage.setItem(OBS_KEY, JSON.stringify(all));
}

export function clearInjectedObs() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OBS_KEY);
}

// Serie fusionada: estática + inyectadas (la inyectada gana si coincide la fecha),
// ordenada y recortada a la ventana móvil de 72 h.
export function getSeriesMerged(stationId: string): Observation[] {
  const map = new Map<string, Observation>();
  for (const o of staticSeries(stationId)) map.set(o.fecha, o);
  for (const o of loadInjectedObs()) {
    if (o.stationId === stationId) map.set(o.fecha, o);
  }
  const merged = [...map.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return merged.slice(-VENTANA_HORAS);
}

// Última lectura válida (qc1-ok) por estación, de la serie fusionada.
export function getLatestMerged(): Record<string, Observation> {
  const map: Record<string, Observation> = {};
  for (const s of getStations()) {
    const serie = getSeriesMerged(s.id);
    for (let i = serie.length - 1; i >= 0; i--) {
      if (serie[i].origen === "qc1-ok") {
        map[s.id] = serie[i];
        break;
      }
    }
  }
  return map;
}

// Reloj del mock: la fecha más reciente de la serie fusionada.
export function getMockNow(): string {
  let max = "";
  for (const s of getStations()) {
    const serie = getSeriesMerged(s.id);
    if (serie.length > 0) {
      const f = serie[serie.length - 1].fecha;
      if (f > max) max = f;
    }
  }
  return max;
}

export function getAlerts(): Alert[] {
  return alerts as Alert[];
}

export function loadAlerts(): Alert[] {
  if (typeof window === "undefined") return getAlerts();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Alert[];
  } catch { /* ignore */ }
  return getAlerts();
}

export function saveAlerts(alertsToSave: Alert[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alertsToSave));
}

// Serie estática (sin overlay) — para SSR y snapshots base.
export function getSeries(stationId: string): Observation[] {
  return staticSeries(stationId);
}

export function getLatestByStation(): Record<string, Observation> {
  const map: Record<string, Observation> = {};
  for (const o of observations as Observation[]) {
    if (!map[o.stationId] || map[o.stationId].fecha < o.fecha) map[o.stationId] = o;
  }
  return map;
}
