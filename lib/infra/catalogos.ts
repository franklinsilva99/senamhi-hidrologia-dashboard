import thresholds from "@/data/thresholds.json";
import forecastInputs from "@/data/forecast_inputs.json";
import type { ForecastDiario, ForecastInput, Thresholds } from "@/lib/domain/types";
import { buildForecastDiario } from "@/lib/domain/pronostico";

// ── Catálogos estáticos (umbrales y modelos de pronóstico) ──
// Implementa el puerto PronosticoRepository y expone los umbrales base.
// La ingesta de pronóstico desde el admin se guarda como overlay en localStorage.

const FORECAST_KEY = "senamhi_forecast_inputs";

export function getThresholds(): Thresholds[] {
  return thresholds as Thresholds[];
}

// ── Overlay de pronóstico (ingesta simulada desde el admin) ──
export function loadInjectedForecast(): ForecastInput[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FORECAST_KEY);
    if (raw) return JSON.parse(raw) as ForecastInput[];
  } catch { /* ignore */ }
  return [];
}

export function appendForecastInputs(inputs: ForecastInput[]) {
  if (typeof window === "undefined") return;
  const map = new Map<string, ForecastInput>();
  for (const f of loadInjectedForecast()) map.set(clave(f), f);
  for (const f of inputs) map.set(clave(f), f);
  localStorage.setItem(FORECAST_KEY, JSON.stringify([...map.values()]));
}

export function clearInjectedForecast() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FORECAST_KEY);
}

function clave(f: ForecastInput): string {
  return `${f.stationId}|${f.fecha}|${f.modelo}`;
}

// Fuente de verdad: estático + overlay (el overlay gana por stationId|fecha|modelo)
export function getForecastInputs(): ForecastInput[] {
  const map = new Map<string, ForecastInput>();
  for (const f of forecastInputs as ForecastInput[]) map.set(clave(f), f);
  for (const f of loadInjectedForecast()) map.set(clave(f), f);
  return [...map.values()];
}

export function getForecastDiario(stationId?: string): ForecastDiario[] {
  const all = buildForecastDiario(getForecastInputs());
  return stationId ? all.filter((f) => f.stationId === stationId) : all;
}
