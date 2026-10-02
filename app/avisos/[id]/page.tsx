"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getAlerts, getSeries, getSeriesMerged, getStations, loadAlerts } from "@/lib/infra/data";
import { getConfigVigente } from "@/lib/infra/configRecords";
import ChartAviso from "@/components/ChartAviso";
import TablaDatosAviso from "@/components/TablaDatosAviso";
import LeyendaNiveles from "@/components/LeyendaNiveles";
import SectionHeader from "@/components/SectionHeader";
import { avisoTabClass } from "@/lib/ui/tabs";
import type { Alert, Observation } from "@/lib/domain/types";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
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
  // Aviso congelado: umbrales snapshot; si no existe (aviso viejo del overlay), cae a la config vigente.
  const u = aviso.umbrales ?? getConfigVigente(aviso.stationId, aviso.preferencia, aviso.inicio)?.umbrales[aviso.tipo];
  const horaUltima = serie.length > 0 ? serie[serie.length - 1].fecha.slice(11, 16) : undefined;

  return (
    <div className="min-h-screen bg-senamhi-bg">
      <SectionHeader title="Hidrologia / Avisos Hidrológicos" />

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <nav aria-label="Pestañas de navegación" className="border-b border-gray-300 mb-6">
          <ul className="flex space-x-1 text-sm">
            <li>
              <Link href="/avisos?tab=mapa" className={avisoTabClass(false)}>
                Mapa
              </Link>
            </li>
            <li>
              <Link href="/avisos?tab=lista" className={avisoTabClass(false)}>
                Lista
              </Link>
            </li>
            <li>
              <Link href="/avisos" className={avisoTabClass(true)}>
                Aviso # {aviso.nro}
              </Link>
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
            umbralAmarilla={u?.amarilla}
            umbralNaranja={u?.naranja}
            umbralRoja={u?.roja}
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
              preferencia={aviso.preferencia}
              nivelActual={aviso.nivelActual}
              caudalActual={aviso.caudalActual}
              cota={aviso.cota}
              hora={horaUltima}
              umbralRojoRel={u?.roja}
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
