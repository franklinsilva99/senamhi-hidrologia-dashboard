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
}

export type TipoAviso = "avenida" | "vigilancia";
export type NivelAlerta = "AMARILLO" | "NARANJA" | "ROJO";

export interface Thresholds {
  stationId: string;
  preferencia: "caudal" | "nivel";
  tipo: TipoAviso;
  nivel: { amarilla: number; naranja: number; roja: number; unidad: "m" };
  caudal: { amarilla: number; naranja: number; roja: number; unidad: "m3/s" };
  duracionHoras: { amarilla: number; naranja: number; roja: number };
  qc1: { min: number; max: number; deltaMax: number };
}

export interface Observation {
  stationId: string;
  fecha: string;
  nivel: number;
  caudal: number;
  origen: "qc1-ok" | "cuarentena";
  estado: "normal" | "amarilla" | "naranja" | "roja";
}

export interface ForecastInput {
  stationId: string;
  fecha: string;
  modelo: string;
  valor: number;
  usuario: string;
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
  serie?: Observation[];
}

export type ModelStatus = "full" | "degraded" | "offline";

export interface ModelInfo {
  nombre: string;
  status: ModelStatus;
  detalle: string;
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
