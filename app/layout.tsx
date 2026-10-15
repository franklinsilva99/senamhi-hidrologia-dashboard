import type { Metadata } from "next";
import HeaderPublico from "@/components/HeaderPublico";
import SoloPublico from "@/components/SoloPublico";
import { Inter, Open_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

// Tipografías de la plantilla SENAMHI: solo las usa el admin (.tema-admin).
// Sin preload, para que las páginas públicas no las descarguen.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "SENAMHI Contingencia Junín | PoC Hidrología",
  description: "Portal contingencia DHI piloto: monitoreo QC1, pronóstico diario (promedio modelos) y avisos — 4 estaciones",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${openSans.variable} ${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-senamhi-bg text-senamhi-text">
        {/* Banda y pie del portal público; el admin tiene su propio layout. */}
        <SoloPublico>
          <HeaderPublico />
        </SoloPublico>
        <div className="flex-1">{children}</div>
        <SoloPublico>
          <footer className="text-xs text-slate-500 max-w-7xl mx-auto px-4 py-4">
            SENAMHI
          </footer>
        </SoloPublico>
      </body>
    </html>
  );
}
