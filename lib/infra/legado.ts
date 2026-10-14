// Compatibilidad de overlays en localStorage: el tipo "vigilancia" se renombró
// a "vaciante". Reemplaza el token exacto (valor de `tipo` o clave de
// `umbrales`) antes de parsear; el texto libre no se ve afectado.
export function parseOverlay<T>(raw: string): T {
  return JSON.parse(raw.replace(/"vigilancia"/g, '"vaciante"')) as T;
}
