import Link from "next/link";

// Banda azul del portal público (en el layout raíz se envuelve con SoloPublico).
export default function HeaderPublico() {
  return (
    <header className="water-banner text-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-lg font-bold leading-tight">SENAMHI · DHI Contingencia</p>
          <p className="text-xs opacity-80">Monitoreo · Pronóstico · Avisos</p>
        </div>
        <nav className="ml-auto flex gap-1 text-sm">
          <Link className="px-3 py-2 rounded hover:bg-white/10" href="/monitoreo">Monitoreo</Link>
          <Link className="px-3 py-2 rounded hover:bg-white/10" href="/pronostico">Pronóstico</Link>
          <Link className="px-3 py-2 rounded hover:bg-white/10" href="/avisos">Avisos</Link>
          <Link className="px-3 py-2 rounded hover:bg-white/10 border border-white/20" href="/admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
