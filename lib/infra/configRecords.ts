import configRecords from "@/data/config_records.json";
import type { ConfigRecord, Variable } from "@/lib/domain/types";

// ── Tabla de configuración (umbrales + vigencia por estación/variable/periodo) ──
// Fuente de verdad de los umbrales y la vigencia de avisos.
// Cada registro tiene un `periodo` (inicio/final): final === null = vigente.
// La edición desde el admin se guarda como overlay en localStorage.

const OVERLAY_KEY = "senamhi_config_records";

function loadOverlay(): ConfigRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (raw) return JSON.parse(raw) as ConfigRecord[];
  } catch { /* ignore */ }
  return [];
}

function clave(stationId: string, variable: Variable): string {
  return `${stationId}|${variable}`;
}

// Estático + overlay (el overlay gana por stationId|variable).
export function getConfigRecords(
  stationId?: string,
  variable?: Variable
): ConfigRecord[] {
  const map = new Map<string, ConfigRecord>();
  for (const r of configRecords as ConfigRecord[]) map.set(clave(r.stationId, r.variable), r);
  for (const r of loadOverlay()) map.set(clave(r.stationId, r.variable), r);
  let list = [...map.values()];
  if (stationId) list = list.filter((r) => r.stationId === stationId);
  if (variable) list = list.filter((r) => r.variable === variable);
  return list;
}

// Variables configuradas para una estación (1 o 2: caudal/nivel).
export function getVariablesConfiguradas(stationId: string): Variable[] {
  const vistos = new Set<Variable>();
  for (const r of getConfigRecords(stationId)) vistos.add(r.variable);
  return [...vistos];
}

// Registro vigente para una (estación, variable) en la fecha dada.
// Cubre si inicio <= fecha <= final (final null = abierto hacia adelante).
// Si hay historial, gana el registro con `inicio` más reciente.
export function getConfigVigente(
  stationId: string,
  variable: Variable,
  fecha: string
): ConfigRecord | null {
  const d = fecha.slice(0, 10);
  const candidatos = getConfigRecords(stationId, variable).filter(
    (r) =>
      r.periodo.inicio <= d &&
      (r.periodo.final === null || d <= r.periodo.final)
  );
  if (candidatos.length === 0) return null;
  return candidatos.sort((a, b) =>
    b.periodo.inicio.localeCompare(a.periodo.inicio)
  )[0];
}

// Guardar el registro de una (estación, variable) como override.
export function setConfigRecord(record: ConfigRecord) {
  if (typeof window === "undefined") return;
  const map = new Map<string, ConfigRecord>();
  for (const r of loadOverlay()) map.set(clave(r.stationId, r.variable), r);
  map.set(clave(record.stationId, record.variable), record);
  localStorage.setItem(OVERLAY_KEY, JSON.stringify([...map.values()]));
}

// Restablecer: quita el override de una (estación, variable) o de toda la estación.
export function resetConfigRecord(stationId: string, variable?: Variable) {
  if (typeof window === "undefined") return;
  const rest = loadOverlay().filter((r) =>
    variable
      ? !(r.stationId === stationId && r.variable === variable)
      : r.stationId !== stationId
  );
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(rest));
}
