import type { DeteccionAviso, Observation, Station, Thresholds } from "./types";
import { clasificarUmbral } from "./umbrales";

// Pool 1 (Bizagi) reducido: clasificar el último dato de cada estación contra sus umbrales.
// Recibe todos los datos por parámetro (dominio puro, sin localStorage ni JSON).
export function detectarAvisos(
  stations: Station[],
  latest: Record<string, Observation>,
  umbrales: Record<string, Thresholds>,
  preferenciaOverride?: Record<string, "caudal" | "nivel">
): DeteccionAviso[] {
  return stations.map((s) => {
    const obs = latest[s.id];
    const th = umbrales[s.id];
    if (!obs || !th) {
      return {
        stationId: s.id,
        valorActual: 0,
        umbral: null,
        preferencia: th?.preferencia ?? "caudal",
        tipo: th?.tipo ?? "avenida",
        excedido: false,
      };
    }
    const preferencia = preferenciaOverride?.[s.id] ?? th.preferencia;
    // Pool 1: la detección compara el valor RELATIVO contra umbrales relativos (sin cota)
    const valorActual = preferencia === "caudal" ? obs.caudal : obs.nivel;
    const umbral = clasificarUmbral(valorActual, th, preferencia);
    // m.s.n.m. solo para visualización (Nivel absoluto = Nivel relativo + Cota)
    const valorAbsoluto =
      preferencia === "nivel" && s.cota !== null ? obs.nivel + s.cota : valorActual;
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
