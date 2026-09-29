import type { ForecastDiario, ForecastInput } from "./types";

// Regla pronóstico diario: 0 modelos -> omitir; 1 -> ese valor; 2+ -> promedio aritmético.
export function buildForecastDiario(inputs: ForecastInput[]): ForecastDiario[] {
  const byKey = new Map<string, ForecastInput[]>();
  for (const f of inputs) {
    const k = `${f.stationId}|${f.fecha}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(f);
  }
  const out: ForecastDiario[] = [];
  for (const [k, list] of byKey) {
    if (list.length === 0) continue;
    const [stationId, fecha] = k.split("|");
    const avg = list.reduce((a, b) => a + b.valor, 0) / list.length;
    out.push({
      stationId,
      fecha,
      caudalPrevisto: Math.round(avg * 10) / 10,
      nModelos: list.length,
      modelos: list.map((f) => f.modelo),
      precision: "reducida-contingencia",
    });
  }
  return out.sort(
    (a, b) => a.stationId.localeCompare(b.stationId) || a.fecha.localeCompare(b.fecha)
  );
}
