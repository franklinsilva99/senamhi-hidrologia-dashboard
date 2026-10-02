"use client";
import { useEffect, useState } from "react";
import TopicBanner from "@/components/TopicBanner";
import MapPronosticoClient from "@/components/MapPronosticoClient";
import { avisoTabClass } from "@/lib/ui/tabs";
import { getStations, getMockNow } from "@/lib/infra/data";
import { getForecastDiario, getForecastInputs } from "@/lib/infra/catalogos";
import { getConfigVigente } from "@/lib/infra/configRecords";
import type { ForecastDiario, ForecastInput } from "@/lib/domain/types";

export default function PronosticoPage() {
  const stations = getStations();
  const [diario, setDiario] = useState<ForecastDiario[]>([]);
  const [inputs, setInputs] = useState<ForecastInput[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setDiario(getForecastDiario());
    setInputs(getForecastInputs());
  }, []);

  // Estaciones con pronóstico + su serie
  const conPronostico = stations.filter((s) => diario.some((f) => f.stationId === s.id));
  const forecastPorEstacion: Record<string, ForecastDiario[]> = {};
  for (const s of conPronostico) forecastPorEstacion[s.id] = diario.filter((f) => f.stationId === s.id);

  // Inputs (modelos) por estación → Min–Max del popup
  const inputsPorEstacion: Record<string, ForecastInput[]> = {};
  for (const s of conPronostico) inputsPorEstacion[s.id] = inputs.filter((i) => i.stationId === s.id);

  // Umbrales según preferencia de la estación (caudal o nivel)
  const umbralesPorEstacion: Record<string, { amarilla: number; naranja: number; roja: number }> = {};
  for (const s of conPronostico) {
    const record = getConfigVigente(s.id, s.preferencia ?? "caudal", getMockNow());
    const u = record?.umbrales[s.tipo ?? "avenida"];
    if (!u) continue;
    umbralesPorEstacion[s.id] = { ...u };
  }

  return (
    <div className="min-h-screen bg-white">
      <TopicBanner
        subtitle="Sistema de Pronóstico Hidrológico"
        title="Hidrología / Pronóstico Hidrológico"
        description="Pronóstico hidrológico diario (D+1 a D+3) como promedio de los modelos ingresados por las direcciones zonales, para los principales ríos y cuencas del país."
      />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav aria-label="Pestañas de pronóstico" className="border-b border-gray-300 mb-6">
          <ul className="flex space-x-1 text-sm">
            <li><a className={avisoTabClass(true)}>Diario</a></li>
            <li><span className={`${avisoTabClass(false)} pointer-events-none opacity-50 cursor-not-allowed`} title="No disponible en contingencia">Mensual</span></li>
            <li><span className={`${avisoTabClass(false)} pointer-events-none opacity-50 cursor-not-allowed`} title="No disponible en contingencia">Horario</span></li>
          </ul>
        </nav>

        <section className="w-full mb-6">
          <h2 className="text-justify text-lg font-bold text-gray-800 uppercase tracking-tight">
            Pronóstico Hidrológico a nivel nacional
          </h2>
          <p className="text-justify text-sm text-gray-700 mt-2 mb-4">
            Pronóstico diario de caudales en cuencas con modelos hidrológicos implementados,
            considerando las previsiones de lluvia con horizonte de 3 días.
          </p>
          
          <MapPronosticoClient
            stations={conPronostico}
            forecastPorEstacion={forecastPorEstacion}
            inputsPorEstacion={inputsPorEstacion}
            umbralesPorEstacion={umbralesPorEstacion}
          />
        </section>

        <footer className="flex justify-center pt-4 pb-2">
          <div className="w-16 h-1 bg-[#0070c0] rounded-full" />
        </footer>
      </main>
    </div>
  );
}
