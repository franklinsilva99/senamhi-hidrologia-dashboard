import stations from "@/data/stations.json";
import type { Station } from "@/lib/domain/types";

// ── Ficha de estación (configurable): preferencia, tipo, cota, variables,
// estado, modo de publicación. Edición como overlay en localStorage.

const KEY = "senamhi_station_config";

type Override = Record<string, Partial<Station>>;

function getOverrides(): Override {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Override;
  } catch { /* ignore */ }
  return {};
}

function saveOverrides(o: Override) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(o));
}

// Estaciones con override de ficha, sobre stations.json.
export function getStationsConfig(): Station[] {
  const ov = getOverrides();
  return (stations as Station[]).map((s) => (ov[s.id] ? { ...s, ...ov[s.id] } : s));
}

export function setStationConfig(stationId: string, partial: Partial<Station>) {
  const o = getOverrides();
  o[stationId] = { ...o[stationId], ...partial };
  saveOverrides(o);
}

export function resetStationConfig(stationId?: string) {
  if (typeof window === "undefined") return;
  if (!stationId) {
    localStorage.removeItem(KEY);
    return;
  }
  const o = getOverrides();
  delete o[stationId];
  saveOverrides(o);
}
