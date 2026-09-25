"use client";
import HidrogramaPopupCard from "@/components/HidrogramaPopupCard";
import ChartHydro from "@/components/ChartHydro";
import type { Observation, Station, TipoAviso } from "@/lib/types";

export default function HidrogramaMonitoreoPopup({
  station,
  series,
  preferencia,
  tipo,
  cota,
  umbralAmarilla,
  umbralNaranja,
  umbralRoja,
  onClose,
}: {
  station: Station;
  series: Observation[];
  preferencia: "caudal" | "nivel";
  tipo: TipoAviso;
  cota: number | null;
  umbralAmarilla?: number;
  umbralNaranja?: number;
  umbralRoja?: number;
  onClose: () => void;
}) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const variable = preferencia === "nivel" ? "Nivel" : "Caudal";

  return (
    <HidrogramaPopupCard
      titulo={`Hidrograma de ${variable} del Río ${station.rio.toUpperCase()}`}
      subtitulo={`Estación ${station.estacion.toUpperCase()}`}
      fecha={hoyISO}
      filename={`hidrograma-${station.rio.toLowerCase()}-${station.id}`}
      onClose={onClose}
      chartHeightClass=""
      chartFullscreenClass=""
    >
      <ChartHydro
        series={series}
        preferencia={preferencia}
        tipo={tipo}
        cota={cota}
        umbralAmarilla={umbralAmarilla}
        umbralNaranja={umbralNaranja}
        umbralRoja={umbralRoja}
      />
    </HidrogramaPopupCard>
  );
}
