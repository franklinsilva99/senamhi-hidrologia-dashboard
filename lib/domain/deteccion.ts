import type {
  DeteccionAviso,
  Observation,
  Station,
  UmbralesActivos,
  Variable,
} from "./types";
import { clasificarActivos } from "./umbrales";
import { valorMostrado } from "./unidades";

// Pool 1 (Bizagi) reducido: clasificar el último dato de cada estación contra sus umbrales.
// Recibe todo por parámetro (dominio puro, sin localStorage ni JSON).
// Usa la `preferencia` de la estación para elegir la variable y evalúa a la vez
// los umbrales de avenida y vaciante activos en la fecha (según su periodo).
export function detectarAvisos(
  stations: Station[],
  latest: Record<string, Observation>,
  umbralesDe: (stationId: string, variable: Variable, fecha: string) => UmbralesActivos,
  fecha: string
): DeteccionAviso[] {
  return stations.map((s) => {
    const obs = latest[s.id];
    // Preferencia de la estación.
    const preferencia = s.preferencia ?? "caudal";
    if (!obs) {
      return { stationId: s.id, valorActual: 0, umbral: null, preferencia, tipo: null, excedido: false };
    }
    // Pool 1: la detección compara el valor RELATIVO contra umbrales relativos (sin cota).
    const valorActual = preferencia === "caudal" ? obs.caudal : obs.nivel;
    const c = clasificarActivos(valorActual, umbralesDe(s.id, preferencia, fecha));
    // Solo para visualización: m.s.n.m. si hay cota, relativo si no.
    const valorAbsoluto = valorMostrado(valorActual, preferencia, s.cota);
    return {
      stationId: s.id,
      valorActual,
      valorAbsoluto,
      umbral: c?.nivel ?? null,
      preferencia,
      tipo: c?.tipo ?? null,
      excedido: c !== null,
    };
  });
}
