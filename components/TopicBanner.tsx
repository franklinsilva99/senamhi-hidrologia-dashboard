export default function TopicBanner({
  badge = "Dirección de Hidrología",
  subtitle,
  title,
  description,
  rightTitle = "Actualización Permanente",
  rightLabel = "Red Hidrológica Nacional",
}: {
  badge?: string;
  subtitle?: string;
  title: string;
  description?: string;
  rightTitle?: string;
  rightLabel?: string;
}) {
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
                  {badge}
                </span>
                {subtitle && <span className="text-xs text-blue-200">{subtitle}</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-blue-100 mt-1 max-w-2xl">{description}</p>
              )}
            </div>
            <div className="hidden lg:flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-lg border border-white/15 backdrop-blur-sm">
              <div className="text-right">
                <div className="text-xs text-blue-200 font-medium">{rightTitle}</div>
                <div className="text-sm font-bold text-white tracking-wide">{rightLabel}</div>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" title="Sistema en línea" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
