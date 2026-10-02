// ── Variables de medición ──
export type Variable = "caudal" | "nivel";
export type Unidad = "m3/s" | "m";

export const UNIDAD_POR_VARIABLE: Record<Variable, Unidad> = {
  caudal: "m3/s",
  nivel: "m",
};

// Umbrales y vigencia por nivel de alerta (amarilla/naranja/roja)
export interface Umbrales {
  amarilla: number;
  naranja: number;
  roja: number;
}

export interface TiempoVigenciaHrs {
  amarilla: number;
  naranja: number;
  roja: number;
}

// Registro de la tabla de configuración: umbrales + vigencia por
// (estación, variable, periodo). `periodo.final === null` = vigente.
// Umbrales por tipo: avenida (ascendente) y vigilancia (descendente);
// una estación puede tener uno o ambos sets. La vigencia es un solo set.
export interface ConfigRecord {
  stationId: string;
  variable: Variable;
  periodo: { inicio: string; final: string | null };
  umbrales: {
    avenida?: Umbrales;
    vigilancia?: Umbrales;
  };
  tiempoVigenciaHrs: TiempoVigenciaHrs;
}

export interface Station {
  id: string;
  n: number;
  cuenca: string;
  estacion: string;
  rio: string;
  codigoAuto: string | null;
  codigoConvencional: string | null;
  dz: string | null;
  escalaTemporal: "Diario";
  region: "Pacifico" | "Titicaca" | "Amazonas";
  lat: number;
  lon: number;
  isEstimated: boolean;
  fuente: string;
  poblados: string[];
  pobladosGeo?: { nombre: string; lat: number; lon: number }[];
  departamento: string;
  provincia: string[];
  distritos: string[];
  polygon: number[][][] | null;
  cota: number | null;
  cotaFuente?: "oficial" | "inventario-altitud" | "dem";
  variables?: Variable[];
  preferencia?: Variable; // cuál variable dispara el aviso
  tipo?: TipoAviso; // avenida (mayor es peor) | vigilancia (menor es peor)
  modoPublicacion?: ModoPublicacion; // automática | manual
  estado?: "activa" | "mantenimiento";
}

export type TipoAviso = "avenida" | "vigilancia";
export type NivelAlerta = "AMARILLO" | "NARANJA" | "ROJO";
export type ModoPublicacion = "automatico" | "manual";

export interface Observation {
  stationId: string;
  fecha: string;
  nivel: number;
  caudal: number;
}

// Lectura de una variable (producto separado: caudal o nivel).
// nivel.json y caudal.json almacenan la serie como Lectura[] (sin estado,
// que se deriva al leer según umbrales y tipo).
export interface Lectura {
  stationId: string;
  fecha: string;
  valor: number;
}

export interface ForecastInput {
  stationId: string;
  fecha: string;
  modelo: string;
  valor: number;
  usuario: string;
  // Primer día pronosticado del grupo de 3 días al que pertenece esta fecha.
  padre?: string;
}

export interface ForecastDiario {
  stationId: string;
  fecha: string;
  caudalPrevisto: number;
  nModelos: number;
  modelos: string[];
  precision: "reducida-contingencia";
}

export interface Alert {
  nro: number;
  ca: string;
  ce: string;
  stationId: string;
  titulo: string;
  cuerpoAgua: string;
  distrito: string;
  inicio: string;
  fin: string;
  duracionHoras: number;
  nivel: NivelAlerta;
  plazo: "normal" | "extendido";
  vigente: boolean;
  fechaEmision: string;
  descripcion: string;
  recomendaciones: string;
  validadoDZ: boolean;
  poblados: string[];
  caudalActual?: number;
  nivelActual?: number;
  preferencia: "caudal" | "nivel";
  tipo: TipoAviso;
  cota?: number | null;
  // Snapshot de umbrales con los que se emitió el aviso (documento congelado).
  umbrales?: Umbrales;
  serie?: Observation[];
}

export interface DeteccionAviso {
  stationId: string;
  valorActual: number;
  valorAbsoluto?: number;
  umbral: NivelAlerta | null;
  preferencia: "caudal" | "nivel";
  tipo: TipoAviso;
  excedido: boolean;
}
