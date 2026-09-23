// Estilo único de las pestañas Mapa / Lista / Aviso (referencia: diseño Stitch).
// Activa: fondo blanco, bordes superior/izquierdo/derecho gris, rounded-t y -mb-px.
// Inactiva: solo texto azul con hover.
export function avisoTabClass(activa: boolean): string {
  return activa
    ? "inline-block px-5 py-2 text-gray-700 bg-white border-t border-l border-r border-gray-300 rounded-t -mb-px font-medium shadow-[0_-1px_2px_rgba(0,0,0,0.03)]"
    : "inline-block px-5 py-2 text-blue-600 hover:text-blue-800 transition-colors font-medium";
}
