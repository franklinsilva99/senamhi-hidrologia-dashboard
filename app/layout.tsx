import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SENAMHI Contingencia Junín | PoC Hidrología",
  description: "Portal contingencia DHI piloto: monitoreo QC1, pronóstico diario (promedio modelos) y avisos — 4 estaciones",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-senamhi-bg text-senamhi-text">
        <div className="bg-senamhi-navy text-white text-xs sm:text-sm px-4 py-2 text-center font-semibold">
          SEDE CONTINGENCIA JUNÍN · PCO · Piloto 4 estaciones reales · QC1 (mín/máx) + promedio de modelos · Sin interrupción
        </div>
        <header className="water-banner text-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-lg font-bold leading-tight">SENAMHI · DHI Contingencia</p>
              <p className="text-xs opacity-80">Monitoreo · Pronóstico diario (promedio modelos) · Avisos — 4 estaciones piloto</p>
            </div>
            <nav className="ml-auto flex gap-1 text-sm">
              <a className="px-3 py-2 rounded hover:bg-white/10" href="/">Resumen</a>
              <a className="px-3 py-2 rounded hover:bg-white/10" href="/monitoreo">Monitoreo</a>
              <a className="px-3 py-2 rounded hover:bg-white/10" href="/pronostico">Pronóstico</a>
              <a className="px-3 py-2 rounded hover:bg-white/10" href="/avisos">Avisos</a>
              <a className="px-3 py-2 rounded hover:bg-white/10 border border-white/20" href="/admin">Admin</a>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="text-xs text-slate-500 max-w-7xl mx-auto px-4 py-4">
          SENAMHI
        </footer>
      </body>
    </html>
  );
}
