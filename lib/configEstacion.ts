import stations from "@/data/stations.json";
import thresholds from "@/data/thresholds.json";
import type { Station, Thresholds } from "./types";

const CONFIG_KEY = "senamhi_config_estaciones";

// Vista combinada: ficha/ubicación (stations.json) + alertas/medición (thresholds.json)
export type ConfigEstacion = Station & Thresholds;

type Override = Record<string, Partial<ConfigEstacion>>;

function getOverrides(): Override {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as Override;
  } catch { /* ignore */ }
  return {};
}

function saveOverrides(o: Override) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(o));
}

const baseStation = (id: string) => (stations as Station[]).find((s) => s.id === id);
const baseThreshold = (id: string) => (thresholds as Thresholds[]).find((t) => t.stationId === id);

export function getConfigEstacion(stationId: string): ConfigEstacion | null {
  const st = baseStation(stationId);
  const th = baseThreshold(stationId);
  if (!st || !th) return null;
  const merged: ConfigEstacion = { ...st, ...th, stationId };
  const ov = getOverrides()[stationId];
  return ov ? { ...merged, ...ov } : merged;
}

export function getConfigMap(): Record<string, ConfigEstacion> {
  const map: Record<string, ConfigEstacion> = {};
  for (const s of stations as Station[]) {
    const c = getConfigEstacion(s.id);
    if (c) map[s.id] = c;
  }
  return map;
}

// Mapa de Thresholds (con overrides) para detección/creación de avisos
export function getConfigThresholdsMap(): Record<string, Thresholds> {
  return getConfigMap();
}

export function setConfigEstacion(stationId: string, partial: Partial<ConfigEstacion>) {
  const o = getOverrides();
  o[stationId] = { ...o[stationId], ...partial };
  saveOverrides(o);
}

export function resetConfigEstacion(stationId?: string) {
  if (typeof window === "undefined") return;
  if (!stationId) {
    localStorage.removeItem(CONFIG_KEY);
    return;
  }
  const o = getOverrides();
  delete o[stationId];
  saveOverrides(o);
}

export function getPreferencia(stationId: string): "caudal" | "nivel" {
  return getConfigEstacion(stationId)?.preferencia ?? "caudal";
}

export function getVariables(stationId: string): ("caudal" | "nivel")[] {
  return getConfigEstacion(stationId)?.variables ?? ["caudal", "nivel"];
}
