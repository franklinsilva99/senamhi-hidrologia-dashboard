"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// Rutas con cabecera y pie propios (plantilla SENAMHI).
const CON_LAYOUT_PROPIO = ["/admin", "/observatorio"];

// Muestra su contenido solo en el portal público; en las rutas con layout
// propio se oculta (p. ej. la banda azul y el pie).
export default function SoloPublico({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (CON_LAYOUT_PROPIO.some((r) => pathname === r || pathname.startsWith(r + "/"))) return null;
  return <>{children}</>;
}
