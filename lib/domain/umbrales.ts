import type { NivelAlerta, NivelUmbral, TipoAviso, Umbral, Umbrales, UmbralesActivos } from "./types";

export const TIPOS: TipoAviso[] = ["avenida", "vaciante"];
export const NIVELES: NivelUmbral[] = ["amarilla", "naranja", "roja"];

const NIVEL_ALERTA: Record<NivelUmbral, NivelAlerta> = {
  amarilla: "AMARILLO",
  naranja: "NARANJA",
  roja: "ROJO",
};

// Clasificación de un valor contra un conjunto de umbrales.
// Única fuente de verdad de la regla de umbrales.
//   avenida  → mayor valor = mayor severidad (incremento)
//   vaciante → menor valor = mayor severidad (descenso)
// Los niveles ausentes (fuera de su periodo) no participan.
export function clasificarNivel(
  valor: number,
  u: Partial<Umbrales>,
  tipo: TipoAviso
): NivelAlerta | null {
  for (const n of ["roja", "naranja", "amarilla"] as const) {
    const lim = u[n];
    if (lim == null) continue;
    if (tipo === "vaciante" ? valor <= lim : valor >= lim) return NIVEL_ALERTA[n];
  }
  return null;
}

// Valores de un set de umbrales activos (para gráficos y snapshot del aviso).
export function valoresDe(set: Partial<Record<NivelUmbral, Umbral>> | undefined): Partial<Umbrales> {
  const out: Partial<Umbrales> = {};
  for (const n of NIVELES) if (set?.[n]) out[n] = set[n]!.valor;
  return out;
}

const SEVERIDAD: Record<NivelAlerta, number> = { AMARILLO: 1, NARANJA: 2, ROJO: 3 };
const NIVEL_UMBRAL: Record<NivelAlerta, NivelUmbral> = { AMARILLO: "amarilla", NARANJA: "naranja", ROJO: "roja" };

// Clasifica un valor contra avenida y vaciante a la vez. Devuelve el umbral
// excedido más severo (empate → avenida), con su vigencia en horas.
export function clasificarActivos(
  valor: number,
  activos: UmbralesActivos
): { tipo: TipoAviso; nivel: NivelAlerta; umbral: Umbral } | null {
  let res: { tipo: TipoAviso; nivel: NivelAlerta; umbral: Umbral } | null = null;
  for (const tipo of TIPOS) {
    const nivel = clasificarNivel(valor, valoresDe(activos[tipo]), tipo);
    if (!nivel || (res && SEVERIDAD[nivel] <= SEVERIDAD[res.nivel])) continue;
    res = { tipo, nivel, umbral: activos[tipo][NIVEL_UMBRAL[nivel]]! };
  }
  return res;
}

// Tipo con el que se dibujan los umbrales en gráficos/mapa: el excedido si lo
// hay; si no, avenida cuando tiene umbrales activos, o vaciante.
export function tipoReferencia(valor: number | undefined, activos: UmbralesActivos): TipoAviso {
  const c = valor != null ? clasificarActivos(valor, activos) : null;
  if (c) return c.tipo;
  return Object.keys(activos.avenida).length > 0 || Object.keys(activos.vaciante).length === 0
    ? "avenida"
    : "vaciante";
}

// ¿El periodo cubre la fecha? (YYYY-MM-DD; fin null = abierto hacia adelante)
export function periodoCubre(p: Umbral["periodo"], fecha: string): boolean {
  const d = fecha.slice(0, 10);
  return p.inicio <= d && (p.fin === null || d <= p.fin);
}

// Umbrales activos en una fecha: por tipo y nivel, el que cubre la fecha
// (si hubiera solape gana el de inicio más reciente).
export function activosEn(umbrales: Umbral[], fecha: string): UmbralesActivos {
  const out: UmbralesActivos = { avenida: {}, vaciante: {} };
  for (const u of umbrales) {
    if (!periodoCubre(u.periodo, fecha)) continue;
    const prev = out[u.tipo][u.nivel];
    if (!prev || u.periodo.inicio > prev.periodo.inicio) out[u.tipo][u.nivel] = u;
  }
  return out;
}

// Periodos que se solapan para un mismo umbral (estación, variable, tipo, nivel).
export function haySolape(a: Umbral, b: Umbral): boolean {
  if (a.stationId !== b.stationId || a.variable !== b.variable || a.tipo !== b.tipo || a.nivel !== b.nivel) return false;
  const finA = a.periodo.fin ?? "9999-12-31";
  const finB = b.periodo.fin ?? "9999-12-31";
  return a.periodo.inicio <= finB && b.periodo.inicio <= finA;
}
