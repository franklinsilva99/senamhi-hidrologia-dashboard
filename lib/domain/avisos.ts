import type {
  Alert,
  ConfigRecord,
  DeteccionAviso,
  NivelAlerta,
  Observation,
  Station,
  TipoAviso,
  Variable,
} from "./types";
import { clasificarNivel } from "./umbrales";
import { RECOMENDACION } from "./nivelesPeligro";

export type AccionAviso = "mantener" | "crear" | "reemplazar";

// Pool 1: ¿Existe aviso previo vigente en esa estación?
export function existeAvisoPrevio(stationId: string, alerts: Alert[]): Alert | null {
  return alerts.find((a) => a.stationId === stationId && a.vigente) ?? null;
}

// Secuencia global de avisos: máximo + 1 (nro) y máximo + 1 (ca)
export function siguienteNro(alerts: Alert[]): number {
  return Math.max(0, ...alerts.map((a) => a.nro)) + 1;
}

export function siguienteCA(alerts: Alert[]): string {
  const max = Math.max(0, ...alerts.map((a) => Number(a.ca) || 0));
  return String(max + 1);
}

// Pool 1 (compuertas BPMN consolidadas en una decisión de 3 salidas):
//   - sin aviso previo              → "crear"
//   - con previo y mismo nivel      → "mantener"   (no se hace nada)
//   - con previo y distinto nivel   → "reemplazar" (desactivar anterior + crear)
export function evaluarAccionAviso(
  stationId: string,
  nuevoNivel: string,
  alerts: Alert[]
): AccionAviso {
  const previo = existeAvisoPrevio(stationId, alerts);
  if (!previo) return "crear";
  return previo.nivel === nuevoNivel ? "mantener" : "reemplazar";
}

export interface PreparacionAviso {
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
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Fecha local "YYYY-MM-DD" (evita el desfase de toISOString/UTC)
function fechaLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Pool 2: preparar el aviso. Devuelve null si el valor no supera umbral (guard explícito).
export function prepararAviso(
  station: Station,
  latest: Record<string, Observation>,
  record: ConfigRecord,
  preferencia: Variable,
  mockNow: string
): PreparacionAviso | null {
  const latestObs = latest[station.id];
  const tipo = station.tipo ?? "avenida";
  const esNivel = preferencia === "nivel";
  // Pool 1: detección con valor RELATIVO contra umbrales relativos (sin cota)
  const valorActual = esNivel ? latestObs?.nivel ?? 0 : latestObs?.caudal ?? 0;
  const u = record.umbrales[tipo];
  const nivel = u ? clasificarNivel(valorActual, u, tipo) : null;
  if (!nivel) return null;

  // Pool 2: visualización en m.s.n.m. (Nivel absoluto = Nivel relativo + Cota)
  const valorMostrado = esNivel && station.cota !== null ? valorActual + station.cota : valorActual;
  const variable = esNivel ? "NIVEL" : "CAUDAL";
  const unidad = esNivel ? "m.s.n.m." : "m³/s";
  const hoy = mockNow ? new Date(mockNow.replace(" ", "T")) : new Date();

  const titulo = `SITUACIÓN ACTUAL DEL ${variable} DEL RÍO ${station.rio.toUpperCase()} - ESTACIÓN ${station.estacion.toUpperCase()}`;
  const cuerpoAgua = `RÍO ${station.rio.toUpperCase()}`;
  const distrito = station.distritos.join(", ") || "—";
  const fechaEmision = `${DIAS[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()} - ${hoy.getHours().toString().padStart(2, "0")}:${hoy.getMinutes().toString().padStart(2, "0")} hrs`;

  const duracionHoras = record.tiempoVigenciaHrs[nivel.toLowerCase() as "amarilla" | "naranja" | "roja"] ?? 200;
  const plazo: "normal" | "extendido" = duracionHoras > 120 ? "extendido" : "normal";
  const finDate = new Date(hoy);
  finDate.setHours(finDate.getHours() + duracionHoras);
  const fin = fechaLocal(finDate);

  const tendencia = tipo === "vigilancia" ? "con tendencia descendente" : "con tendencia ascendente";
  const descripcion = `El SENAMHI, organismo adscrito al Ministerio del Ambiente, informa sobre el comportamiento hidrológico del ${cuerpoAgua}. La estación hidrológica ${station.estacion.toUpperCase()}, registró un ${variable} de ${valorMostrado.toFixed(2)} ${unidad}, ${tendencia}, ubicándose en el umbral ${nivel}. Las potenciales áreas de afectación serían los centros poblados de ${station.poblados.map((p) => p.toUpperCase()).join(", ")}. Se recomienda a la población tomar las precauciones correspondientes y evitar realizar cualquier actividad cercana al río. El SENAMHI continuará vigilante al comportamiento del río y sugiere a la ciudadanía mantenerse informada a través de la web institucional y redes sociales.`;

  const recomendaciones = RECOMENDACION[tipo][nivel];

  return {
    titulo, cuerpoAgua, distrito, nivel, descripcion, recomendaciones,
    fechaEmision, fin, duracionHoras, plazo, poblados: station.poblados, tipo,
  };
}

export interface DatosCrearAviso {
  station: Station;
  latest: Record<string, Observation>;
  record: ConfigRecord;
  preferencia: Variable;
  mockNow: string;
  serie: Observation[];
  nro: number;
  ca: string;
}

// Pool 2: Crear aviso completo (preparación + generación). Función pura.
export function crearAviso(d: DatosCrearAviso): Alert {
  const { station, latest, record, preferencia, mockNow, serie, nro, ca } = d;
  const preparacion = prepararAviso(station, latest, record, preferencia, mockNow);
  if (!preparacion) {
    throw new Error(`No hay umbral excedido para la estación ${station.id}`);
  }
  const latestObs = latest[station.id];

  const inicio = mockNow ? mockNow.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const esNivel = preferencia === "nivel";
  const cota = station.cota ?? null;
  // Nivel absoluto (m.s.n.m.) = Nivel relativo + Cota
  const nivelActual = esNivel && cota !== null ? (latestObs?.nivel ?? 0) + cota : undefined;

  return {
    nro,
    ca,
    ce: station.codigoAuto ?? "00000000",
    stationId: station.id,
    titulo: preparacion.titulo,
    cuerpoAgua: preparacion.cuerpoAgua,
    distrito: preparacion.distrito,
    inicio,
    fin: preparacion.fin,
    duracionHoras: preparacion.duracionHoras,
    nivel: preparacion.nivel,
    plazo: preparacion.plazo,
    vigente: true,
    fechaEmision: preparacion.fechaEmision,
    descripcion: preparacion.descripcion,
    recomendaciones: preparacion.recomendaciones,
    validadoDZ: false,
    poblados: preparacion.poblados,
    caudalActual: esNivel ? undefined : latestObs?.caudal,
    nivelActual,
    preferencia,
    tipo: preparacion.tipo,
    cota,
    serie,
  };
}

// Aplicar un aviso respetando las compuertas (desactivación condicional). Función pura.
export function aplicarAviso(
  base: Alert[],
  aviso: Alert
): { next: Alert[]; texto: string } {
  const accion = evaluarAccionAviso(aviso.stationId, aviso.nivel, base);
  if (accion === "mantener") {
    return {
      next: base,
      texto: `Sin cambios: la estación ya tiene un aviso vigente en nivel ${aviso.nivel}.`,
    };
  }
  if (accion === "reemplazar") {
    const previo = existeAvisoPrevio(aviso.stationId, base);
    const next = base
      .map((a) => (a.stationId === aviso.stationId && a.vigente ? { ...a, vigente: false } : a))
      .concat(aviso);
    return {
      next,
      texto: `Aviso #${previo?.nro} desactivado. Nuevo aviso #${aviso.nro} publicado (${aviso.nivel}).`,
    };
  }
  return { next: base.concat(aviso), texto: `Aviso #${aviso.nro} publicado correctamente (${aviso.nivel}).` };
}

export interface DepsProcesarDeteccion {
  stations: Station[];
  latest: Record<string, Observation>;
  configVigenteDe: (
    stationId: string,
    variable: Variable,
    fecha: string
  ) => ConfigRecord | null;
  serieDe: (stationId: string) => Observation[];
  mockNow: string;
}

// Orquestador: recorre la detección y aplica crear/reemplazar/mantener sobre una colección.
export function procesarDeteccion(
  base: Alert[],
  det: DeteccionAviso[],
  deps: DepsProcesarDeteccion
): { next: Alert[]; textos: string[] } {
  let next = base;
  const textos: string[] = [];
  for (const d of det) {
    if (!d.excedido || !d.umbral) continue;
    if (evaluarAccionAviso(d.stationId, d.umbral, next) === "mantener") continue;
    const station = deps.stations.find((s) => s.id === d.stationId);
    if (!station) continue;
    // Solo auto-publica si la estación está en modo automático.
    if (station.modoPublicacion === "manual") continue;
    const preferencia = d.preferencia;
    const record = deps.configVigenteDe(d.stationId, preferencia, deps.mockNow);
    if (!record) continue;
    const aviso = crearAviso({
      station,
      latest: deps.latest,
      record,
      preferencia,
      mockNow: deps.mockNow,
      serie: deps.serieDe(d.stationId),
      nro: siguienteNro(next),
      ca: siguienteCA(next),
    });
    const res = aplicarAviso(next, aviso);
    next = res.next;
    textos.push(res.texto);
  }
  return { next, textos };
}
