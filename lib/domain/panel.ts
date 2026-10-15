import type {
  Alert,
  DeteccionAviso,
  ForecastInput,
  ModoPublicacion,
  NivelAlerta,
  Observation,
  Station,
  TipoAviso,
} from "./types";
import { avisoPendiente, evaluarAccionAviso, existeAvisoPrevio, venceEn } from "./avisos";

// Panel administrativo: estado operativo por estación (qué hay que hacer ahora).
// Dominio puro: recibe estaciones, avisos, última lectura, detección y pronóstico.

// Horas sin lectura a partir de las cuales una estación se marca "sin dato reciente".
export const HORAS_SIN_DATO = 3;

export interface PendientePublicacion {
  nivel: NivelAlerta;
  tipo: TipoAviso;
  accion: "crear" | "reemplazar";
}

export interface FilaPanel {
  station: Station;
  modo: ModoPublicacion;
  enMantenimiento: boolean;
  aviso: Alert | null; // aviso vigente
  vence: string | null; // fin exacto del aviso vigente
  horasParaVencer: number | null;
  rioNormal: boolean; // tiene aviso vigente pero el último dato ya no supera umbral
  pendiente: PendientePublicacion | null; // detección que pide crear/reemplazar
  avisoPendiente: Alert | null; // aviso ya generado que espera aprobación (modo manual)
  ultimoDato: string | null;
  sinDato: boolean;
  modelos: number; // modelos distintos cargados en el grupo de pronóstico
  diasConPronostico: number; // días del grupo con al menos un modelo
  pronosticoPendiente: boolean;
}

// Suma días a una fecha YYYY-MM-DD (mismo formato, hora local).
function sumarDias(base: string, dias: number): string {
  const d = new Date(`${base}T00:00`);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function horasEntre(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

// Grupo de pronóstico vigente: los 3 días siguientes al reloj del mock
// (el mismo bloque que abre por defecto /admin/pronostico).
export function grupoPronostico(ahora: string): string[] {
  const primerDia = sumarDias(ahora.slice(0, 10), 1);
  return [0, 1, 2].map((i) => sumarDias(primerDia, i));
}

export interface DatosPanel {
  stations: Station[];
  alerts: Alert[];
  latest: Record<string, Observation>;
  deteccion: DeteccionAviso[];
  inputs: ForecastInput[];
  ahora: string;
}

export function filasPanel(d: DatosPanel): FilaPanel[] {
  const grupo = grupoPronostico(d.ahora);

  return d.stations.map((s) => {
    const enMantenimiento = s.estado === "mantenimiento";
    const aviso = existeAvisoPrevio(s.id, d.alerts);

    const det = d.deteccion.find((x) => x.stationId === s.id);
    let pendiente: PendientePublicacion | null = null;
    if (det?.excedido && det.umbral && det.tipo) {
      const accion = evaluarAccionAviso(s.id, det.umbral, det.tipo, d.alerts);
      if (accion !== "mantener") pendiente = { nivel: det.umbral, tipo: det.tipo, accion };
    }

    const ultimoDato = d.latest[s.id]?.fecha ?? null;
    const sinDato =
      !enMantenimiento && (ultimoDato === null || horasEntre(ultimoDato, d.ahora) > HORAS_SIN_DATO);

    const delGrupo = d.inputs.filter((f) => f.stationId === s.id && grupo.includes(f.fecha));
    const modelos = new Set(delGrupo.map((f) => f.modelo)).size;
    const diasConPronostico = new Set(delGrupo.map((f) => f.fecha)).size;

    return {
      station: s,
      modo: s.modoPublicacion ?? "automatico",
      enMantenimiento,
      aviso,
      vence: aviso ? venceEn(aviso) : null,
      horasParaVencer: aviso ? horasEntre(d.ahora, venceEn(aviso)) : null,
      rioNormal: aviso !== null && det !== undefined && !det.excedido,
      pendiente,
      avisoPendiente: avisoPendiente(s.id, d.alerts),
      ultimoDato,
      sinDato,
      modelos,
      diasConPronostico,
      pronosticoPendiente: !enMantenimiento && diasConPronostico < grupo.length,
    };
  });
}

const SEVERIDAD: Record<NivelAlerta, number> = { ROJO: 0, NARANJA: 1, AMARILLO: 2 };

// Orden de atención: por publicar → sin dato → avisos vigentes (más severo y
// más próximo a vencer primero) → pronóstico pendiente → resto.
function prioridad(f: FilaPanel): number[] {
  if (f.pendiente) return [0, SEVERIDAD[f.pendiente.nivel]];
  if (f.sinDato) return [1, 0];
  if (f.aviso) return [2, SEVERIDAD[f.aviso.nivel], f.horasParaVencer ?? 0];
  if (f.pronosticoPendiente) return [3, 0];
  return [4, 0];
}

export function ordenarPorAtencion(filas: FilaPanel[]): FilaPanel[] {
  return [...filas].sort((a, b) => {
    const pa = prioridad(a);
    const pb = prioridad(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return a.station.n - b.station.n;
  });
}
