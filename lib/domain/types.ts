// ── Variables de medición ──
export type Variable = "caudal" | "nivel";
export type Unidad = "m3/s" | "m";

export const UNIDAD_POR_VARIABLE: Record<Variable, Unidad> = {
  caudal: "m3/s",
  nivel: "m",
};

// Valores de umbral por nivel de alerta (amarilla/naranja/roja). Parcial
// cuando algún nivel no está activo en la fecha consultada.
export interface Umbrales {
  amarilla: number;
  naranja: number;
  roja: number;
}

export type NivelUmbral = keyof Umbrales;

// Tabla de umbrales: una fila por umbral (estación, variable, tipo, nivel).
// Hasta 12 por estación (2 variables × 2 tipos × 3 niveles). Cada umbral
// tiene su valor, la vigencia en horas del aviso que genera y el periodo
// (fechas fijas) en que está activo; fuera de su periodo no genera avisos.
// Un mismo umbral puede repetirse con periodos distintos (sin solaparse).
export interface Umbral {
  stationId: string;
  variable: Variable;
  tipo: TipoAviso;
  nivel: NivelUmbral;
  valor: number;
  vigenciaHrs: number;
  periodo: { inicio: string; fin: string | null }; // fin null = abierto
}

// Umbrales activos de una (estación, variable) en una fecha, por tipo y nivel.
export type UmbralesActivos = Record<TipoAviso, Partial<Record<NivelUmbral, Umbral>>>;

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
  pobladosGeo?: PobladoGeo[];
  // Cobertura administrativa: se calcula a partir de los centros poblados
  // (ver `conCobertura`); listas porque una estación puede estar en frontera.
  departamento: string[];
  provincia: string[];
  distritos: string[];
  polygon: number[][][] | null;
  cota: number | null;
  cotaFuente?: "oficial" | "inventario-altitud" | "dem";
  variables?: Variable[];
  preferencia?: Variable; // cuál variable dispara el aviso (avenida y vaciante se evalúan a la vez)
  modoPublicacion?: ModoPublicacion; // automática | manual
  estado?: "activa" | "mantenimiento";
}

// Ubicación administrativa de un centro poblado (texto libre en el PoC).
export interface UbicacionPoblado {
  nombre: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
}

// Centro poblado afectado por una estación: ubicación + coordenadas.
export interface PobladoGeo extends UbicacionPoblado {
  lat: number;
  lon: number;
}

export type TipoAviso = "avenida" | "vaciante";
export type NivelAlerta = "AMARILLO" | "NARANJA" | "ROJO";
export type ModoPublicacion = "automatico" | "manual";
// Ciclo de publicación de un aviso. "pendiente": modo manual, espera aprobación
// (no es público ni cuenta como aviso previo). Ausente = "publicado".
export type EstadoAviso = "pendiente" | "publicado" | "descartado";

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
  // Fin exacto de la vigencia ("YYYY-MM-DDTHH:mm", reloj del mock) = emisión + duracionHoras.
  vence?: string;
  duracionHoras: number;
  nivel: NivelAlerta;
  plazo: "normal" | "extendido";
  vigente: boolean;
  estado?: EstadoAviso;
  fechaEmision: string;
  descripcion: string;
  recomendaciones: string;
  validadoDZ: boolean;
  poblados: string[];
  // Snapshot de la ubicación de los centros poblados afectados al emitir.
  pobladosUbicacion?: UbicacionPoblado[];
  caudalActual?: number;
  nivelActual?: number;
  preferencia: "caudal" | "nivel";
  tipo: TipoAviso;
  cota?: number | null;
  // Snapshot de umbrales con los que se emitió el aviso (documento congelado).
  umbrales?: Partial<Umbrales>;
  serie?: Observation[];
}

export interface DeteccionAviso {
  stationId: string;
  valorActual: number;
  valorAbsoluto?: number;
  umbral: NivelAlerta | null;
  preferencia: "caudal" | "nivel";
  tipo: TipoAviso | null; // tipo del umbral excedido (null si no hay)
  excedido: boolean;
}
