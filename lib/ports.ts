import type { ModelInfo, ModelStatus } from "./types";

export const USE_PISCO_LITE =
  process.env.NEXT_PUBLIC_USE_PISCO_LITE !== "false";

export interface HydrologyPort {
  getModelStatus(): ModelInfo[];
  getPrecipitation(
    stationId: string,
    fecha: string
  ): { mm: number; fuente: string };
}

// Estado degradado asumido para mini-DC Junín:
// - RS MINERVE / GR2M / WRF / ETA regional: offline (no replicables)
// - PISCO-light: degraded (recorte 26 cuencas, pre-procesado en nube/mini-DC)
// - GFS 0.25 + GPM: degraded (solo internet, fallback)
// - Persistencia + umbrales: degraded (operativo en contingencia)
export function getModelStatus(): ModelInfo[] {
  const pisco: ModelInfo = {
    nombre: "PISCO-light (precipitación grillada, recorte 26 cuencas)",
    status: USE_PISCO_LITE ? "degraded" : "offline",
    detalle: USE_PISCO_LITE
      ? "Activo en modo ligero: pre-procesado, resolución degradada, solo ventana avenidas. Precisión reducida."
      : "Desactivado por flag. Se usa fallback GFS.",
  };
  const resto: ModelInfo[] = [
    {
      nombre: "GFS 0.25 NOAA + GPM (fallback lluvia)",
      status: "degraded",
      detalle: "Descarga directa internet, sin NUNA. Solo apoyo.",
    },
    {
      nombre: "RS MINERVE (diario 3 días) / GR2M (mensual)",
      status: "offline",
      detalle:
        "No replicable en contingencia: requiere \\bak_2, FTP BD_Minerve y calibración central.",
    },
    {
      nombre: "WRF / ETA32 / ETA22 regional",
      status: "offline",
      detalle: "Requiere supercomputo/NUNA sede central.",
    },
    {
      nombre: "Persistencia + umbrales (modelo contingencia)",
      status: "degraded",
      detalle:
        "Q(t+1..3) = f(Q obs + lluvia PISCO/GFS) + umbrales amarilla/naranja/roja. Operativo.",
    },
    {
      nombre: "PHISIS-full / GOES-decoder / ADMIN",
      status: "offline",
      detalle:
        "Se usa PHISIS-lite + BD Postgres-lite + ingreso manual DZ/WhatsApp/CSV.",
    },
  ];
  return [pisco, ...resto];
}

export function modelBadge(s: ModelStatus): string {
  if (s === "full") return "bg-green-100 text-green-800";
  if (s === "degraded") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}
