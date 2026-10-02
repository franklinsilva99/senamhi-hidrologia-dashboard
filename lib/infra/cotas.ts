import cotas from "@/data/cotas.json";
import type { Station } from "@/lib/domain/types";

// ── Catálogo de cotas (cero de la regla por estación) ──
// Antes la cota vivía embebida en stations.json; ahora es un catálogo propio.
// La ficha (Station) se resuelve con la cota al cargar, sin cambiar el tipo ni
// las reglas de negocio (la detección sigue comparando valores relativos).

interface CotaRecord {
  stationId: string;
  cota: number | null;
  cotaFuente?: "oficial" | "inventario-altitud" | "dem";
}

const COTA_MAP = new Map((cotas as CotaRecord[]).map((c) => [c.stationId, c]));

// Inyecta la cota a las estaciones base (stations.json ya no la trae).
export function withCotass(stations: Station[]): Station[] {
  return stations.map((s) => {
    const c = COTA_MAP.get(s.id);
    return {
      ...s,
      cota: c?.cota ?? null,
      cotaFuente: c?.cotaFuente,
    };
  });
}
