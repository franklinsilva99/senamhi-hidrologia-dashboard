import type {
  Alert,
  DeteccionAviso,
  NivelAlerta,
  Observation,
  Station,
  TipoAviso,
  UmbralesActivos,
  Variable,
} from "./types";
import { clasificarActivos, valoresDe } from "./umbrales";
import { RECOMENDACION } from "./nivelesPeligro";

export type AccionAviso = "mantener" | "crear" | "reemplazar";

// Un aviso sin `estado` (avisos base) se considera publicado.
export function esPublicado(a: Alert): boolean {
  return (a.estado ?? "publicado") === "publicado";
}

// Pool 1: ¿Existe aviso previo vigente (publicado) en esa estación?
export function existeAvisoPrevio(stationId: string, alerts: Alert[]): Alert | null {
  return alerts.find((a) => a.stationId === stationId && a.vigente && esPublicado(a)) ?? null;
}

// Aviso de la estación que espera aprobación (modo manual).
export function avisoPendiente(stationId: string, alerts: Alert[]): Alert | null {
  return alerts.find((a) => a.stationId === stationId && a.estado === "pendiente") ?? null;
}

const mismoAviso = (a: Alert, b: Alert) => a.ca === b.ca && a.ce === b.ce;

// Fin exacto de la vigencia. Avisos sin `vence` (overlay antiguo): fin del día `fin`.
export function venceEn(a: Alert): string {
  return a.vence ?? `${a.fin}T23:59`;
}

export function estaVencido(a: Alert, ahora: string): boolean {
  return ahora >= venceEn(a);
}

// La vigencia se deriva al leer: un aviso publicado deja de estar vigente al
// cumplirse su duración. Al volver el río a la normalidad no se cierra solo;
// vence por su vigencia o el operador lo deshabilita. Función pura.
export function aplicarVencimiento(alerts: Alert[], ahora: string): Alert[] {
  if (!ahora) return alerts;
  return alerts.map((a) => (a.vigente && esPublicado(a) && estaVencido(a, ahora) ? { ...a, vigente: false } : a));
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
//   - con previo, mismo nivel y tipo         → "mantener"   (no se hace nada)
//   - con previo y distinto nivel o tipo     → "reemplazar" (desactivar anterior + crear)
export function evaluarAccionAviso(
  stationId: string,
  nuevoNivel: string,
  nuevoTipo: TipoAviso | null,
  alerts: Alert[]
): AccionAviso {
  const previo = existeAvisoPrevio(stationId, alerts);
  if (!previo) return "crear";
  return previo.nivel === nuevoNivel && previo.tipo === nuevoTipo ? "mantener" : "reemplazar";
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
  vence: string;
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
  activos: UmbralesActivos,
  preferencia: Variable,
  mockNow: string
): PreparacionAviso | null {
  const latestObs = latest[station.id];
  const esNivel = preferencia === "nivel";
  // Pool 1: detección con valor RELATIVO contra umbrales relativos (sin cota),
  // avenida y vaciante a la vez; el umbral excedido define tipo, nivel y vigencia.
  const valorActual = esNivel ? latestObs?.nivel ?? 0 : latestObs?.caudal ?? 0;
  const c = clasificarActivos(valorActual, activos);
  if (!c) return null;
  const { tipo, nivel } = c;

  // Pool 2: visualización en m.s.n.m. (Nivel absoluto = Nivel relativo + Cota)
  const valorMostrado = esNivel && station.cota != null ? valorActual + station.cota : valorActual;
  const variable = esNivel ? "NIVEL" : "CAUDAL";
  const unidad = esNivel ? "m.s.n.m." : "m³/s";
  const hoy = mockNow ? new Date(mockNow.replace(" ", "T")) : new Date();

  const titulo = `SITUACIÓN ACTUAL DEL ${variable} DEL RÍO ${station.rio.toUpperCase()} - ESTACIÓN ${station.estacion.toUpperCase()}`;
  const cuerpoAgua = `RÍO ${station.rio.toUpperCase()}`;
  const distrito = station.distritos.join(", ") || "—";
  const fechaEmision = `${DIAS[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()} - ${hoy.getHours().toString().padStart(2, "0")}:${hoy.getMinutes().toString().padStart(2, "0")} hrs`;

  const duracionHoras = c.umbral.vigenciaHrs;
  const plazo: "normal" | "extendido" = duracionHoras > 120 ? "extendido" : "normal";
  const finDate = new Date(hoy);
  finDate.setHours(finDate.getHours() + duracionHoras);
  const fin = fechaLocal(finDate);
  const vence = `${fin}T${String(finDate.getHours()).padStart(2, "0")}:${String(finDate.getMinutes()).padStart(2, "0")}`;

  const tendencia = tipo === "vaciante" ? "con tendencia descendente" : "con tendencia ascendente";
  const descripcion = `El SENAMHI, organismo adscrito al Ministerio del Ambiente, informa sobre el comportamiento hidrológico del ${cuerpoAgua}. La estación hidrológica ${station.estacion.toUpperCase()}, registró un ${variable} de ${valorMostrado.toFixed(2)} ${unidad}, ${tendencia}, ubicándose en el umbral ${nivel}. Las potenciales áreas de afectación serían los centros poblados de ${station.poblados.map((p) => p.toUpperCase()).join(", ")}. Se recomienda a la población tomar las precauciones correspondientes y evitar realizar cualquier actividad cercana al río. El SENAMHI continuará vigilante al comportamiento del río y sugiere a la ciudadanía mantenerse informada a través de la web institucional y redes sociales.`;

  const recomendaciones = RECOMENDACION[tipo][nivel];

  return {
    titulo, cuerpoAgua, distrito, nivel, descripcion, recomendaciones,
    fechaEmision, fin, vence, duracionHoras, plazo, poblados: station.poblados, tipo,
  };
}

export interface DatosCrearAviso {
  station: Station;
  latest: Record<string, Observation>;
  activos: UmbralesActivos;
  preferencia: Variable;
  mockNow: string;
  serie: Observation[];
  nro: number;
  ca: string;
}

// Pool 2: Crear aviso completo (preparación + generación). Función pura.
export function crearAviso(d: DatosCrearAviso): Alert {
  const { station, latest, activos, preferencia, mockNow, serie, nro, ca } = d;
  const preparacion = prepararAviso(station, latest, activos, preferencia, mockNow);
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
    vence: preparacion.vence,
    duracionHoras: preparacion.duracionHoras,
    nivel: preparacion.nivel,
    plazo: preparacion.plazo,
    vigente: true,
    fechaEmision: preparacion.fechaEmision,
    descripcion: preparacion.descripcion,
    recomendaciones: preparacion.recomendaciones,
    validadoDZ: false,
    poblados: preparacion.poblados,
    // Se congela la ubicación de cada centro poblado afectado.
    pobladosUbicacion: preparacion.poblados.map((nombre) => {
      const p = station.pobladosGeo?.find((g) => g.nombre === nombre);
      return { nombre, distrito: p?.distrito, provincia: p?.provincia, departamento: p?.departamento };
    }),
    caudalActual: esNivel ? undefined : latestObs?.caudal,
    nivelActual,
    preferencia,
    tipo: preparacion.tipo,
    cota,
    umbrales: valoresDe(activos[preparacion.tipo]),
    serie,
  };
}

// Aplicar un aviso respetando las compuertas (desactivación condicional). Función pura.
export function aplicarAviso(
  base: Alert[],
  aviso: Alert
): { next: Alert[]; texto: string } {
  const accion = evaluarAccionAviso(aviso.stationId, aviso.nivel, aviso.tipo, base);
  if (accion === "mantener") {
    return {
      next: base,
      texto: `Sin cambios: la estación ya tiene un aviso vigente de ${aviso.tipo} en nivel ${aviso.nivel}.`,
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

// Modo manual ("Preparar aviso cuya publicación debe ser aprobada"): el aviso queda
// pendiente, sin publicarse ni desactivar el anterior. Si la estación ya tenía un
// pendiente de otro nivel o tipo, se reemplaza conservando su número. Función pura.
export function dejarPendiente(
  base: Alert[],
  aviso: Alert
): { next: Alert[]; texto: string | null } {
  const pendiente: Alert = { ...aviso, estado: "pendiente", vigente: false };
  const previo = avisoPendiente(aviso.stationId, base);
  if (!previo) {
    return { next: base.concat(pendiente), texto: `Aviso #${aviso.nro} pendiente de aprobación (${aviso.nivel}).` };
  }
  if (previo.nivel === aviso.nivel && previo.tipo === aviso.tipo) return { next: base, texto: null };
  return {
    next: base.map((a) => (mismoAviso(a, previo) ? { ...pendiente, nro: previo.nro, ca: previo.ca } : a)),
    texto: `Aviso #${previo.nro} pendiente actualizado (${previo.nivel} → ${aviso.nivel}).`,
  };
}

// Aprobar un pendiente: se publica y recién ahí se desactiva el aviso vigente anterior,
// para que la estación no quede sin aviso público mientras espera. Función pura.
export function aprobarAviso(base: Alert[], aviso: Alert): { next: Alert[]; texto: string } {
  const previo = existeAvisoPrevio(aviso.stationId, base);
  const next = base.map((a) => {
    if (mismoAviso(a, aviso)) return { ...a, estado: "publicado" as const, vigente: true, validadoDZ: true };
    if (previo && mismoAviso(a, previo)) return { ...a, vigente: false };
    return a;
  });
  return {
    next,
    texto: previo
      ? `Aviso #${aviso.nro} aprobado y publicado (${aviso.nivel}). Aviso #${previo.nro} desactivado.`
      : `Aviso #${aviso.nro} aprobado y publicado (${aviso.nivel}).`,
  };
}

export function descartarAviso(base: Alert[], aviso: Alert): { next: Alert[]; texto: string } {
  return {
    next: base.map((a) => (mismoAviso(a, aviso) ? { ...a, estado: "descartado" as const, vigente: false } : a)),
    texto: `Aviso #${aviso.nro} descartado.`,
  };
}

export interface DepsProcesarDeteccion {
  stations: Station[];
  latest: Record<string, Observation>;
  umbralesDe: (stationId: string, variable: Variable, fecha: string) => UmbralesActivos;
  serieDe: (stationId: string) => Observation[];
  mockNow: string;
}

// Orquestador: recorre la detección y aplica crear/reemplazar/mantener sobre una colección.
// Modo automático → publica (aplicarAviso). Modo manual → deja el aviso pendiente.
// Un pendiente que ya no corresponde (no supera umbral o el vigente ya lo cubre) se descarta.
export function procesarDeteccion(
  base: Alert[],
  det: DeteccionAviso[],
  deps: DepsProcesarDeteccion
): { next: Alert[]; textos: string[] } {
  let next = base;
  const textos: string[] = [];
  const descartarPendiente = (stationId: string, motivo: string) => {
    const p = avisoPendiente(stationId, next);
    if (!p) return;
    next = descartarAviso(next, p).next;
    textos.push(`Aviso #${p.nro} pendiente descartado: ${motivo}.`);
  };

  for (const d of det) {
    if (!d.excedido || !d.umbral) {
      descartarPendiente(d.stationId, "ya no supera umbral");
      continue;
    }
    if (evaluarAccionAviso(d.stationId, d.umbral, d.tipo, next) === "mantener") {
      descartarPendiente(d.stationId, "el aviso vigente ya cubre ese nivel");
      continue;
    }
    const station = deps.stations.find((s) => s.id === d.stationId);
    if (!station) continue;
    const manual = station.modoPublicacion === "manual";
    if (!manual) descartarPendiente(d.stationId, "la estación pasó a publicación automática");
    const pendiente = avisoPendiente(d.stationId, next);
    const preferencia = d.preferencia;
    const aviso = crearAviso({
      station,
      latest: deps.latest,
      activos: deps.umbralesDe(d.stationId, preferencia, deps.mockNow),
      preferencia,
      mockNow: deps.mockNow,
      serie: deps.serieDe(d.stationId),
      nro: pendiente?.nro ?? siguienteNro(next),
      ca: pendiente?.ca ?? siguienteCA(next),
    });
    const res = manual ? dejarPendiente(next, aviso) : aplicarAviso(next, aviso);
    next = res.next;
    if (res.texto) textos.push(res.texto);
  }
  return { next, textos };
}
