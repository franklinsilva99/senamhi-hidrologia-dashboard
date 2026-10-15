import type { Variable } from "./types";

// Unidad y valor con que se MUESTRA una lectura (la detección siempre usa el
// valor relativo contra umbrales relativos, sin cota).
// - Caudal → m³/s.
// - Nivel con cota → m.s.n.m. (nivel absoluto = nivel relativo + cota).
// - Nivel sin cota → m (relativo al cero de la regla).

export type UnidadMostrada = "m³/s" | "m.s.n.m." | "m";

export function unidadMostrada(preferencia: Variable | undefined, cota: number | null | undefined): UnidadMostrada {
  if (preferencia !== "nivel") return "m³/s";
  return cota != null ? "m.s.n.m." : "m";
}

export function valorMostrado(
  valorRelativo: number,
  preferencia: Variable | undefined,
  cota: number | null | undefined
): number {
  return preferencia === "nivel" && cota != null ? valorRelativo + cota : valorRelativo;
}
