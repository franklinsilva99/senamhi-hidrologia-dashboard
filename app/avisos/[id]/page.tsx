"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getAlerts, getSeries, getSeriesMerged, getStations, loadAlerts } from "@/lib/data";
import { getThresholds } from "@/lib/queries";
import ChartAviso from "@/components/ChartAviso";
import TablaDatosAviso from "@/components/TablaDatosAviso";
import LeyendaNiveles from "@/components/LeyendaNiveles";
import SectionHeader from "@/components/SectionHeader";
import type { Alert, Observation } from "@/lib/types";

const badge: Record<string, string> = {
  AMARILLO: "bg-[#ffeb3b] text-black",
  NARANJA: "bg-[#fca326] text-white",
  ROJO: "bg-[#ee3d43] text-white",
};

function formatFechaES(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

export default function AvisoDetalle() {
  const params = useParams();
  const id = params.id as string;
  const [ca, ce] = id.split("-");

  const [alerts, setAlerts] = useState<Alert[]>(getAlerts);
  const [serie, setSerie] = useState<Observation[]>(() => {
    const a = getAlerts().find((x) => x.ca === ca && x.ce === ce);
    return a ? a.serie ?? getSeries(a.stationId) : [];
  });

  useEffect(() => {
    const stored = loadAlerts();
    setAlerts(stored);
    const a = stored.find((x) => x.ca === ca && x.ce === ce);
    // Aviso publicado: serie congelada (snapshot). Si no tiene, serie fusionada.
    if (a) setSerie(a.serie ?? getSeriesMerged(a.stationId));
  }, [ca, ce]);

  const aviso = alerts.find((a) => a.ca === ca && a.ce === ce);

  if (!aviso) {
    return (
      <div className="min-h-screen bg-senamhi-bg flex items-center justify-center">
        <p className="text-slate-500">Aviso no encontrado</p>
      </div>
    );
  }

  const st = getStations().find((s) => s.id === aviso.stationId);
  const th = getThresholds().find((t) => t.stationId === aviso.stationId);
  const horaUltima = serie.length > 0 ? serie[serie.length - 1].fecha.slice(11, 16) : undefined;

  return (
    <div className="min-h-screen bg-senamhi-bg">
      <SectionHeader title="Hidrologia / Avisos Hidrológicos" />

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <nav className="flex gap-0 text-sm border-b border-slate-300">
          <a
            href="/avisos"
            className="px-5 py-2.5 border border-b-0 border-slate-300 bg-white hover:bg-slate-50 text-[#00539b] font-medium rounded-t"
          >
            Mapa
          </a>
          <a
            href="/avisos"
            className="px-5 py-2.5 border border-b-0 border-slate-300 bg-white hover:bg-slate-50 text-[#00539b] font-medium rounded-t"
          >
            Lista
          </a>
          <span className="px-5 py-2.5 border border-b-0 border-slate-300 bg-white text-slate-600 font-medium rounded-t">
            Aviso # {aviso.nro}
          </span>
        </nav>

        <section className="bg-white rounded-b-xl rounded-tr border border-slate-300 p-5 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-800">
              Aviso N°{aviso.nro}
            </h2>
            <span className={`px-5 py-2 rounded text-sm font-bold ${badge[aviso.nivel]}`}>
              {aviso.nivel}
            </span>
          </div>

          <div className="text-right text-sm text-slate-500">
            Fecha de emisión: {aviso.fechaEmision}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-center text-[#dc2626] leading-snug">
            {aviso.titulo}
          </h1>

          <div className="space-y-1 text-sm mt-4">
            <p><strong>Fecha de inicio: </strong>{formatFechaES(aviso.inicio)}</p>
            <p><strong>Fecha de final: </strong>{formatFechaES(aviso.fin)}</p>
            <p><strong>Plazo: </strong>Plazo {aviso.plazo}</p>
          </div>

          <p className="text-sm text-justify leading-relaxed mt-4">
            {aviso.descripcion}
          </p>
        </section>

        <section className="bg-white rounded-xl border border-slate-300 p-5 sm:p-8">
          <ChartAviso
            series={serie}
            titulo={`HIDROGRAMA DE ${aviso.cuerpoAgua}`}
            estacion={st?.estacion?.toUpperCase() ?? ""}
            preferencia={aviso.preferencia}
            tipo={aviso.tipo}
            cota={aviso.cota}
            umbralAmarilla={aviso.preferencia === "nivel" ? th?.nivel.amarilla : th?.caudal.amarilla}
            umbralNaranja={aviso.preferencia === "nivel" ? th?.nivel.naranja : th?.caudal.naranja}
            umbralRoja={aviso.preferencia === "nivel" ? th?.nivel.roja : th?.caudal.roja}
          />
          <p className="text-xs text-slate-400 italic mt-2">
            Nota: Información en tiempo casi real, sujeto a revisión y validación
          </p>
        </section>

        {st && (
          <section className="bg-white rounded-xl border border-slate-300 p-5 sm:p-8">
            <TablaDatosAviso
              station={st}
              thresholds={th}
              preferencia={aviso.preferencia}
              nivelActual={aviso.nivelActual}
              caudalActual={aviso.caudalActual}
              cota={aviso.cota}
              hora={horaUltima}
            />
          </section>
        )}

        <section className="bg-white rounded-xl border border-slate-300 p-5 sm:p-8">
          <LeyendaNiveles tipo={aviso.tipo} />
        </section>

        <div className="flex justify-center py-4">
          <div className="w-16 h-1 bg-[#00539b] rounded" />
        </div>
      </div>
    </div>
  );
}
