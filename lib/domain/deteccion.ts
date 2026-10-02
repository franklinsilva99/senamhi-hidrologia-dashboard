import type {
  ConfigRecord,
  DeteccionAviso,
  Observation,
  Station,
  Variable,
} from "./types";
import { clasificarNivel } from "./umbrales";

// Pool 1 (Bizagi) reducido: clasificar el último dato de cada estación contra sus umbrales.
// Recibe todo por parámetro (dominio puro, sin localStorage ni JSON).
// Usa la `preferencia` de la estación para elegir la variable y el `ConfigRecord`
// vigente (según su `periodo`) para clasificar contra los umbrales.
export function detectarAvisos(
  stations: Station[],
  latest: Record<string, Observation>,
  configVigenteDe: (
    stationId: string,
    variable: Variable,
    fecha: string
  ) => ConfigRecord | null,
  fecha: string
): DeteccionAviso[] {
  return stations.map((s) => {
    const obs = latest[s.id];
    // Preferencia de la estación.
    const preferencia = s.preferencia ?? "caudal";
    const tipo = s.tipo ?? "avenida";
    const record = configVigenteDe(s.id, preferencia, fecha);
    if (!obs || !record) {
      return {
        stationId: s.id,
        valorActual: 0,
        umbral: null,
        preferencia,
        tipo,
        excedido: false,
      };
    }
    // Pool 1: la detección compara el valor RELATIVO contra umbrales relativos (sin cota).
    const valorActual = preferencia === "caudal" ? obs.caudal : obs.nivel;
    const u = record.umbrales[tipo];
    const umbral = u ? clasificarNivel(valorActual, u, tipo) : null;
    // m.s.n.m. solo para visualización (Nivel absoluto = Nivel relativo + Cota).
    const valorAbsoluto =
      preferencia === "nivel" && s.cota != null
        ? obs.nivel + s.cota
        : valorActual;
    return {
      stationId: s.id,
      valorActual,
      valorAbsoluto,
      umbral,
      preferencia,
      tipo,
      excedido: umbral !== null,
    };
  });
}
