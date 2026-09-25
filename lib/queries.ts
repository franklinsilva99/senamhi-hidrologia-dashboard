import thresholds from "@/data/thresholds.json";
import forecastInputs from "@/data/forecast_inputs.json";
import type { DeteccionAviso, ForecastDiario, ForecastInput, NivelAlerta, Observation, Thresholds, TipoAviso } from "./types";
import { getStations, getLatestMerged, getMockNow } from "./data";
import { RECOMENDACION } from "./nivelesPeligro";

export function getThresholds(): Thresholds[] {
  return thresholds as Thresholds[];
}

export function getForecastInputs(): ForecastInput[] {
  return forecastInputs as ForecastInput[];
}

// Regla pronóstico diario: 0 modelos -> omitir; 1 -> ese valor; 2+ -> promedio aritmético.
export function buildForecastDiario(): ForecastDiario[] {
  const inputs = getForecastInputs();
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
  return out.sort((a, b) => a.stationId.localeCompare(b.stationId) || a.fecha.localeCompare(b.fecha));
}

export function getForecastDiario(stationId?: string): ForecastDiario[] {
  const all = buildForecastDiario();
  return stationId ? all.filter((f) => f.stationId === stationId) : all;
}

// ── Flujo Bizagi: Detección de avisos ──

export function clasificarUmbral(valor: number, th: Thresholds, preferencia: "caudal" | "nivel"): NivelAlerta | null {
  const u = preferencia === "caudal" ? th.caudal : th.nivel;
  if (th.tipo === "vigilancia") {
    // Vigilancia: menor valor = mayor severidad (descenso del nivel/caudal)
    if (valor <= u.roja) return "ROJO";
    if (valor <= u.naranja) return "NARANJA";
    if (valor <= u.amarilla) return "AMARILLO";
    return null;
  }
  // Avenida: mayor valor = mayor severidad (incremento)
  if (valor >= u.roja) return "ROJO";
  if (valor >= u.naranja) return "NARANJA";
  if (valor >= u.amarilla) return "AMARILLO";
  return null;
}

export function detectarAvisos(latestOverride?: Record<string, Observation>, preferenciaOverride?: Record<string, "caudal" | "nivel">, thresholdsOverride?: Record<string, Thresholds>): DeteccionAviso[] {
  const stations = getStations();
  const baseLatest = getLatestMerged();
  const latest = latestOverride ? { ...baseLatest, ...latestOverride } : baseLatest;
  const allThresholds = thresholdsOverride ? Object.values(thresholdsOverride) : getThresholds();
  const thMap = Object.fromEntries(allThresholds.map((t) => [t.stationId, t]));

  return stations.map((s) => {
    const obs = latest[s.id];
    const th = thMap[s.id];
    if (!obs || !th) {
      return { stationId: s.id, valorActual: 0, umbral: null, preferencia: th?.preferencia ?? "caudal", tipo: th?.tipo ?? "avenida", excedido: false };
    }
    const preferencia = preferenciaOverride?.[s.id] ?? th.preferencia;
    // Pool 1: la detección compara el valor RELATIVO contra umbrales relativos (sin cota)
    const valorActual = preferencia === "caudal" ? obs.caudal : obs.nivel;
    const umbral = clasificarUmbral(valorActual, th, preferencia);
    // m.s.n.m. solo para visualización (Nivel absoluto = Nivel relativo + Cota)
    const valorAbsoluto = preferencia === "nivel" && s.cota !== null ? obs.nivel + s.cota : valorActual;
    return {
      stationId: s.id,
      valorActual,
      valorAbsoluto,
      umbral,
      preferencia,
      tipo: th.tipo,
      excedido: umbral !== null,
    };
  });
}

export function prepararAviso(stationId: string, latestOverride?: Record<string, Observation>, preferenciaOverride?: Record<string, "caudal" | "nivel">, thresholdsOverride?: Record<string, Thresholds>): {
  titulo: string;
  cuerpoAgua: string;
  distrito: string;
  nivel: NivelAlerta;
  descripcion: string;
  recomendaciones: string;
  fechaEmision: string;
  fin: string;
  duracionHoras: number;
  plazo: "normal" | "extendido";
  poblados: string[];
  tipo: TipoAviso;
} {
  const station = getStations().find((s) => s.id === stationId)!;
  const baseLatest = getLatestMerged();
  const latest = latestOverride ? { ...baseLatest, ...latestOverride } : baseLatest;
  const latestObs = latest[stationId];
  const th = thresholdsOverride?.[stationId] ?? getThresholds().find((t) => t.stationId === stationId)!;
  const preferencia = preferenciaOverride?.[stationId] ?? th.preferencia;
  const tipo = th.tipo;
  const esNivel = preferencia === "nivel";
  // Pool 1: detección con valor RELATIVO contra umbrales relativos (sin cota)
  const valorActual = esNivel ? latestObs?.nivel ?? 0 : latestObs?.caudal ?? 0;
  const nivel = clasificarUmbral(valorActual, th, preferencia)!;

  // Pool 2: visualización en m.s.n.m. (Nivel absoluto = Nivel relativo + Cota)
  const valorMostrado = esNivel && station.cota !== null ? valorActual + station.cota : valorActual;
  const variable = esNivel ? "NIVEL" : "CAUDAL";
  const unidad = esNivel ? "m.s.n.m." : "m³/s";
  const mockNow = getMockNow();
  const hoy = mockNow ? new Date(mockNow.replace(" ", "T")) : new Date();
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const titulo = `SITUACIÓN ACTUAL DEL ${variable} DEL RÍO ${station.rio.toUpperCase()} - ESTACIÓN ${station.estacion.toUpperCase()}`;
  const cuerpoAgua = `RÍO ${station.rio.toUpperCase()}`;
  const distrito = station.distritos.join(", ") || "—";
  const fechaEmision = `${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()} - ${hoy.getHours().toString().padStart(2, "0")}:${hoy.getMinutes().toString().padStart(2, "0")} hrs`;

  const duracionHoras = th.duracionHoras[nivel.toLowerCase() as "amarilla" | "naranja" | "roja"] ?? 200;
  const plazo: "normal" | "extendido" = duracionHoras > 120 ? "extendido" : "normal";
  const finDate = new Date(hoy);
  finDate.setHours(finDate.getHours() + duracionHoras);
  const fin = finDate.toISOString().split("T")[0];

  const tendencia = tipo === "vigilancia" ? "con tendencia descendente" : "con tendencia ascendente";
  const descripcion = `El SENAMHI, organismo adscrito al Ministerio del Ambiente, informa sobre el comportamiento hidrológico del ${cuerpoAgua}. La estación hidrológica ${station.estacion.toUpperCase()}, registró un ${variable} de ${valorMostrado.toFixed(2)} ${unidad}, ${tendencia}, ubicándose en el umbral ${nivel}. Las potenciales áreas de afectación serían los centros poblados de ${station.poblados.map((p) => p.toUpperCase()).join(", ")}. Se recomienda a la población tomar las precauciones correspondientes y evitar realizar cualquier actividad cercana al río. El SENAMHI continuará vigilante al comportamiento del río y sugiere a la ciudadanía mantenerse informada a través de la web institucional y redes sociales.`;

  const recomendaciones = RECOMENDACION[tipo][nivel];

  return {
    titulo, cuerpoAgua, distrito, nivel, descripcion, recomendaciones,
    fechaEmision, fin, duracionHoras, plazo, poblados: station.poblados, tipo,
  };
}

export function generarCA(): string {
  return String(70000 + Math.floor(Math.random() * 9999));
}

export { getStations };
