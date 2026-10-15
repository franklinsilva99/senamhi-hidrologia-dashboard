"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// Muestra su contenido solo en el portal público. El admin tiene su propio
// layout (plantilla SENAMHI), así que ahí se oculta (p. ej. banda y pie).
export default function SoloPublico({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}
