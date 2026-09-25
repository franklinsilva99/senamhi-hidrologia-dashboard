import TopicBanner from "@/components/TopicBanner";
import MapMonitoreoClient from "@/components/MapMonitoreoClient";
import { getStations } from "@/lib/data";
import { avisoTabClass } from "@/lib/tabs";

export default function MonitoreoPage() {
  const stations = getStations();

  return (
    <div className="min-h-screen bg-white">
      <TopicBanner
        subtitle="Sistema de Monitoreo Hidrológico"
        title="Hidrología / Monitoreo Hidrológico"
        description="Información disponible de niveles y/o caudales de la red de monitoreo hidrológico del Servicio Nacional de Meteorología e Hidrología del Perú (SENAMHI)."
      />

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav aria-label="Pestañas de monitoreo" className="border-b border-gray-300 mb-6">
          <ul className="flex space-x-1 text-sm">
            <li><a className={avisoTabClass(true)}>Monitoreo Hidrológico</a></li>
            <li><span className={`${avisoTabClass(false)} pointer-events-none opacity-50 cursor-not-allowed`} title="No disponible en contingencia">Información Diaria</span></li>
            <li><span className={`${avisoTabClass(false)} pointer-events-none opacity-50 cursor-not-allowed`} title="No disponible en contingencia">Información Mensual</span></li>
          </ul>
        </nav>

        <section className="w-full mb-6">
          <h2 className="text-center text-lg font-bold text-gray-800 uppercase tracking-tight">
            Monitoreo Hidrológico a nivel nacional
          </h2>
          <p className="text-justify text-sm text-gray-700 mt-2 mb-4">
            Información disponible de niveles y/o caudales de la red de monitoreo hidrológico del
            Servicio Nacional de Meteorología e Hidrología del Perú (SENAMHI). Haga clic en una estación
            para ver su hidrograma.
          </p>
          <MapMonitoreoClient stations={stations} />
        </section>

        <footer className="flex justify-center pt-4 pb-2">
          <div className="w-16 h-1 bg-[#0070c0] rounded-full" />
        </footer>
      </main>
    </div>
  );
}
