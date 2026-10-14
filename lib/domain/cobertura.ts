import type { Station } from "./types";

// Cobertura administrativa de la estación = unión de la ubicación de sus
// centros poblados (distrito/provincia/departamento). Así una estación de
// frontera queda en varios departamentos sin editarlo a mano. Si ningún
// centro poblado tiene ese dato, se conserva el valor base de la estación.
export function conCobertura(s: Station): Station {
  const geo = s.pobladosGeo ?? [];
  const unicos = (xs: (string | undefined)[]) =>
    [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))];
  const departamento = unicos(geo.map((p) => p.departamento));
  const provincia = unicos(geo.map((p) => p.provincia));
  const distritos = unicos(geo.map((p) => p.distrito));
  return {
    ...s,
    departamento: departamento.length ? departamento : s.departamento,
    provincia: provincia.length ? provincia : s.provincia,
    distritos: distritos.length ? distritos : s.distritos,
  };
}
