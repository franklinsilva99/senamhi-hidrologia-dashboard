export default function AvisosBanner() {
  return (
    <>
      {/* Barra institucional */}
      <header className="bg-[#f2f2f2] border-b border-gray-300 text-xs text-gray-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4">
            <span className="font-bold tracking-wide text-[#333333]">GOBIERNO DEL PERÚ</span>
            <span className="text-gray-300">|</span>
            <span>Ministerio del Ambiente</span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              Servicio Nacional de Meteorología e Hidrología del Perú - <strong>SENAMHI</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Banner de agua */}
      <section className="water-banner text-white shadow-md border-b-4 border-senamhi-lightblue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white/20 text-white backdrop-blur-sm">
                  Dirección de Hidrología
                </span>
                <span className="text-xs text-blue-200">Sistema de Avisos Hidrológicos</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                Hidrología / Avisos Hidrológicos
              </h1>
              <p className="text-sm text-blue-100 mt-1 max-w-2xl">
                Monitoreo en tiempo real del caudal y niveles de agua en los principales ríos y cuencas hidrográficas del territorio nacional.
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-lg border border-white/15 backdrop-blur-sm">
              <div className="text-right">
                <div className="text-xs text-blue-200 font-medium">Actualización Permanente</div>
                <div className="text-sm font-bold text-white tracking-wide">Red Hidrológica Nacional</div>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" title="Sistema en línea" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
