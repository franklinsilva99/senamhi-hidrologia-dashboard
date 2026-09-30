import type { NivelAlerta, TipoAviso } from "./types";

// Clasificación de un valor contra un conjunto de umbrales.
// Única fuente de verdad de la regla de umbrales.
//   avenida    → mayor valor = mayor severidad (incremento)
//   vigilancia → menor valor = mayor severidad (descenso)
export function clasificarNivel(
  valor: number,
  u: { amarilla: number; naranja: number; roja: number },
  tipo: TipoAviso
): NivelAlerta | null {
  if (tipo === "vigilancia") {
    if (valor <= u.roja) return "ROJO";
    if (valor <= u.naranja) return "NARANJA";
    if (valor <= u.amarilla) return "AMARILLO";
    return null;
  }
  if (valor >= u.roja) return "ROJO";
  if (valor >= u.naranja) return "NARANJA";
  if (valor >= u.amarilla) return "AMARILLO";
  return null;
}
