import thresholds from "@/data/thresholds.json";
import forecastInputs from "@/data/forecast_inputs.json";
import type { ForecastDiario, ForecastInput, Thresholds } from "@/lib/domain/types";
import { buildForecastDiario } from "@/lib/domain/pronostico";

// ── Catálogos estáticos (umbrales y modelos de pronóstico) ──
// Implementa el puerto PronosticoRepository y expone los umbrales base.

export function getThresholds(): Thresholds[] {
  return thresholds as Thresholds[];
}

export function getForecastInputs(): ForecastInput[] {
  return forecastInputs as ForecastInput[];
}

export function getForecastDiario(stationId?: string): ForecastDiario[] {
  const all = buildForecastDiario(getForecastInputs());
  return stationId ? all.filter((f) => f.stationId === stationId) : all;
}
