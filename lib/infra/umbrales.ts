import umbralesBase from "@/data/umbrales.json";
import type { NivelUmbral, TipoAviso, Umbral, UmbralesActivos, Variable } from "@/lib/domain/types";
import { activosEn } from "@/lib/domain/umbrales";
import { parseOverlay } from "@/lib/infra/legado";

// ── Tabla de umbrales (una fila por umbral: estación, variable, tipo, nivel) ──
// Fuente de verdad de los umbrales, la vigencia (h) del aviso y el periodo en
// que cada umbral está activo. La edición desde el admin se guarda como
// overlay en localStorage: la lista completa de umbrales de cada estación
// editada reemplaza a la del JSON.

const OVERLAY_KEY = "senamhi_umbrales";
const LEGACY_KEY = "senamhi_config_records";

type Overlay = Record<string, Umbral[]>;

// Overlay anterior (un registro por estación/variable con sets por tipo).
interface RegistroLegado {
  stationId: string;
  variable: Variable;
  periodo: { inicio: string; final: string | null };
  umbrales: Partial<Record<TipoAviso, Record<NivelUmbral, number>>>;
  tiempoVigenciaHrs: Partial<Record<TipoAviso, Record<NivelUmbral, number>>> | Record<NivelUmbral, number>;
}

function desdeLegado(registros: RegistroLegado[]): Overlay {
  const out: Overlay = {};
  for (const r of registros) {
    for (const tipo of ["avenida", "vaciante"] as const) {
      const u = r.umbrales[tipo];
      if (!u) continue;
      const v = r.tiempoVigenciaHrs;
      const vig = "amarilla" in v ? (v as Record<NivelUmbral, number>) : (v as Partial<Record<TipoAviso, Record<NivelUmbral, number>>>)[tipo];
      for (const nivel of ["amarilla", "naranja", "roja"] as const) {
        (out[r.stationId] ??= []).push({
          stationId: r.stationId,
          variable: r.variable,
          tipo,
          nivel,
          valor: u[nivel],
          vigenciaHrs: vig?.[nivel] ?? 200,
          periodo: { inicio: r.periodo.inicio, fin: r.periodo.final },
        });
      }
    }
  }
  return out;
}

function loadOverlay(): Overlay {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (raw) return JSON.parse(raw) as Overlay;
    const legado = localStorage.getItem(LEGACY_KEY);
    if (legado) {
      // Para cada estación editada con el formato anterior, se completan las
      // variables que no tenía en el overlay con las del JSON base.
      const conv = desdeLegado(parseOverlay<RegistroLegado[]>(legado));
      for (const [id, rows] of Object.entries(conv)) {
        const vars = new Set(rows.map((r) => r.variable));
        conv[id] = rows.concat(
          (umbralesBase as Umbral[]).filter((u) => u.stationId === id && !vars.has(u.variable))
        );
      }
      return conv;
    }
  } catch { /* ignore */ }
  return {};
}

// Estático + overlay (el overlay reemplaza los umbrales de la estación).
export function getUmbrales(stationId?: string, variable?: Variable): Umbral[] {
  const ov = loadOverlay();
  let list = (umbralesBase as Umbral[]).filter((u) => !ov[u.stationId]);
  for (const rows of Object.values(ov)) list = list.concat(rows);
  if (stationId) list = list.filter((u) => u.stationId === stationId);
  if (variable) list = list.filter((u) => u.variable === variable);
  return list;
}

// Umbrales activos de una (estación, variable) en la fecha dada, por tipo y nivel.
export function getUmbralesActivos(stationId: string, variable: Variable, fecha: string): UmbralesActivos {
  return activosEn(getUmbrales(stationId, variable), fecha);
}

// Guardar todos los umbrales de una estación como override.
export function setUmbralesEstacion(stationId: string, umbrales: Umbral[]) {
  if (typeof window === "undefined") return;
  const ov = loadOverlay();
  ov[stationId] = umbrales;
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(ov));
  localStorage.removeItem(LEGACY_KEY);
}

// Restablecer: quita el override de una estación (vuelve al JSON base).
export function resetUmbralesEstacion(stationId: string) {
  if (typeof window === "undefined") return;
  const ov = loadOverlay();
  delete ov[stationId];
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(ov));
  localStorage.removeItem(LEGACY_KEY);
}
