import type { NivelAlerta, TipoAviso } from "./types";

export type NivelKey = NivelAlerta;

export const NIVELES: NivelKey[] = ["AMARILLO", "NARANJA", "ROJO"];

export const NIVEL_LABEL: Record<NivelKey, string> = {
  AMARILLO: "Amarillo",
  NARANJA: "Naranja",
  ROJO: "Rojo",
};

// Colores exactos SENAMHI (nav-pills nivel-1/2/3)
export const NIVEL_SENAMHI: Record<NivelKey, { bg: string; text: string }> = {
  AMARILLO: { bg: "#fbfb05", text: "#000000" },
  NARANJA: { bg: "#ffa500", text: "#ffffff" },
  ROJO: { bg: "#fb0505", text: "#ffffff" },
};

// Peligro por nivel. Avenida: menor a mayor severidad por incremento.
// Vigilancia: menor a mayor severidad por descenso del nivel/caudal.
export const PELIGRO: Record<TipoAviso, Record<NivelKey, string>> = {
  avenida: {
    AMARILLO: "Indica condiciones normales del río con la posibilidad de incremento en su nivel.",
    NARANJA: "Indica condiciones del río con tendencia ascendente en su nivel, con posibilidad de alcanzar el umbral rojo.",
    ROJO: "Indica condiciones de peligro por el incremento del nivel o caudal del río, con posible desborde e inundación de zonas ribereñas. Se recomienda evitar cualquier actividad cercana al cauce.",
  },
  vigilancia: {
    AMARILLO: "Indica condiciones normales del río con la posibilidad de descenso en su nivel.",
    NARANJA: "Indica condiciones del río con tendencia descendente en su nivel.",
    ROJO: "Indica condiciones donde se esperan limitaciones en el transporte fluvial ocasionado por el avistamiento de rocas y obstáculos debido a un mayor descenso en el nivel del río, que puede generar daños y el encallamiento de naves fluviales.",
  },
};

// Recomendación por nivel y tipo (fuente: lib/queries.ts prepararAviso)
export const RECOMENDACION: Record<TipoAviso, Record<NivelKey, string>> = {
  avenida: {
    AMARILLO: "Seguir reportes de la DZ. Mantenerse informado por la web institucional del SENAMHI.",
    NARANJA: "Evitar cruce de cauce, alejar bienes de riberas. Mantenerse informado por la web institucional del SENAMHI.",
    ROJO: "Evitar cruzar el cauce, alejar bienes de riberas. Seguir indicaciones de la DZ y COEN.",
  },
  vigilancia: {
    AMARILLO: "Vigilar el descenso del nivel del río. Mantenerse informado por la web institucional del SENAMHI.",
    NARANJA: "Precaución por la tendencia descendente del nivel. Mantenerse informado por la web institucional del SENAMHI.",
    ROJO: "Restringir la navegación y actividades fluviales por el descenso del nivel. Seguir indicaciones de la DZ y COEN.",
  },
};
