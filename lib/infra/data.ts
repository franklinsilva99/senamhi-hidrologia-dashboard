import stations from "@/data/stations.json";
import nivelSerie from "@/data/nivel.json";
import caudalSerie from "@/data/caudal.json";
import alerts from "@/data/alerts.json";
import type { Alert, Lectura, Observation, Station } from "@/lib/domain/types";
import { withCotass } from "@/lib/infra/cotas";

// ── Adaptador de persistencia (PoC): JSON estático separado por producto ──
// Implementa los puertos StationRepository / ObservacionRepository / AvisoRepository.
// Fuente de verdad: nivel.json + caudal.json (series por variable), unidas al leer.

const STORAGE_KEY = "senamhi_avisos";
const VENTANA_HORAS = 72;

export function getStations(): Station[] {
  return withCotass(stations as Station[]);
}

// Serie por variable: fecha → valor de una estación.
function serieDe(lecturas: Lectura[], stationId: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lecturas) {
    if (l.stationId === stationId) m.set(l.fecha, l.valor);
  }
  return m;
}

// Serie fusionada: caudal + nivel unidos por fecha, ordenada y sin duplicar.
function joinSeries(stationId: string): Observation[] {
  const n = serieDe(nivelSerie as Lectura[], stationId);
  const c = serieDe(caudalSerie as Lectura[], stationId);
  const fechas = new Set([...n.keys(), ...c.keys()]);
  const out: Observation[] = [];
  for (const fecha of fechas) {
    const nivel = n.get(fecha);
    const caudal = c.get(fecha);
    // Solo puntos con ambas variables (los productos horarios vienen alineados).
    if (nivel == null || caudal == null) continue;
    out.push({ stationId, fecha, nivel, caudal });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Serie fusionada recortada a la ventana móvil de 72 h.
export function getSeriesMerged(stationId: string): Observation[] {
  return joinSeries(stationId).slice(-VENTANA_HORAS);
}

// Serie completa (sin ventana) — para snapshots base y SSR.
export function getSeries(stationId: string): Observation[] {
  return joinSeries(stationId);
}

// Última lectura por estación, de la serie fusionada.
export function getLatestMerged(): Record<string, Observation> {
  const map: Record<string, Observation> = {};
  for (const s of getStations()) {
    const serie = getSeriesMerged(s.id);
    if (serie.length > 0) map[s.id] = serie[serie.length - 1];
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
