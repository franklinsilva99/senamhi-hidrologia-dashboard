"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getAlerts, getSeries, getSeriesMerged, getStations, loadAlerts } from "@/lib/data";
import { getThresholds } from "@/lib/queries";
import ChartAviso from "@/components/ChartAviso";
import TablaDatosAviso from "@/components/TablaDatosAviso";
import LeyendaNiveles from "@/components/LeyendaNiveles";
import SectionHeader from "@/components/SectionHeader";
import { avisoTabClass } from "@/lib/tabs";
import type { Alert, Observation } from "@/lib/types";

const badge: Record<string, string> = {
  AMARILLO: "bg-[#FFFF00] text-black",
  NARANJA: "bg-[#FF9900] text-white",
  ROJO: "bg-[#FF0000] text-white",
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

      <main className="w-full max-w-5xl bg-white min-h-[900px] shadow-sm my-4 md:my-6 p-4 sm:p-8 md:p-10 border border-gray-200 mx-auto">
        <nav aria-label="Pestañas de navegación" className="border-b border-gray-300 mb-6">
          <ul className="flex space-x-1 text-sm">
            <li>
              <a href="/avisos?tab=mapa" className={avisoTabClass(false)}>
                Mapa
              </a>
            </li>
            <li>
              <a href="/avisos?tab=lista" className={avisoTabClass(false)}>
                Lista
              </a>
            </li>
            <li>
              <a href="/avisos" className={avisoTabClass(true)}>
                Aviso # {aviso.nro}
              </a>
            </li>
          </ul>
        </nav>

        {/* Cabecera del aviso */}
        <section className="bg-[#f0f2f5] p-2 flex justify-end items-center mb-1">
          <div className="flex items-center space-x-3">
            <span className="text-xl font-bold text-black tracking-tight">
              Aviso N°{aviso.nro}
            </span>
            <div className={`${badge[aviso.nivel]} font-extrabold text-base px-6 py-1 tracking-wider shadow-sm select-none`}>
              {aviso.nivel}
            </div>
          </div>
        </section>
        <div className="text-right text-xs text-gray-600 mb-6 font-normal">
          Fecha de emisión: {aviso.fechaEmision}
        </div>

        {/* Título */}
        <section className="text-center mb-8 px-2">
          <h2 className="text-red-600 font-extrabold text-2xl md:text-[28px] leading-tight tracking-normal uppercase">
            {aviso.titulo}
          </h2>
        </section>

        {/* Metadatos y descripción */}
        <section className="mb-8 text-sm text-gray-800 leading-relaxed max-w-4xl mx-auto">
          <div className="space-y-1 mb-5">
            <p><strong className="font-bold text-gray-900">Fecha de inicio:</strong> {formatFechaES(aviso.inicio)}</p>
            <p><strong className="font-bold text-gray-900">Fecha de final:</strong> {formatFechaES(aviso.fin)}</p>
            <p><strong className="font-bold text-gray-900">Plazo:</strong> {aviso.plazo === "extendido" ? "Extendido" : "Normal"}</p>
          </div>
          <p className="text-justify text-gray-700 leading-normal text-[13.5px]">
            {aviso.descripcion}
          </p>
        </section>

        {/* Hidrograma */}
        <section className="w-full max-w-4xl mx-auto mb-10 border border-gray-100 p-2 sm:p-4 rounded">
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
          <p className="text-center text-[11px] text-gray-500 italic mt-3">
            Nota: Información en tiempo casi real, sujeto a revisión y validación
          </p>
        </section>

        {/* Tabla resumen */}
        {st && (
          <section className="max-w-3xl mx-auto mb-8 overflow-hidden rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
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

        {/* Leyenda de umbrales */}
        <section className="max-w-4xl mx-auto mb-10">
          <LeyendaNiveles tipo={aviso.tipo} />
        </section>

        <footer className="flex justify-center pt-2 pb-4">
          <div className="w-16 h-1 bg-[#0070c0] rounded-full" />
        </footer>
      </main>
    </div>
  );
}
