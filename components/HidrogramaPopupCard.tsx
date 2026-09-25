"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toPng, toJpeg } from "html-to-image";

// Tarjeta-popup reutilizable de hidrograma: card + barra de fecha + menú (pantalla completa / descarga) + footer.
// Solo UI: recibe el gráfico en `children`; no contiene lógica de negocio.
export default function HidrogramaPopupCard({
  titulo,
  subtitulo,
  fecha,
  filename,
  onClose,
  chartHeightClass = "h-[210px]",
  chartFullscreenClass = "h-[70vh]",
  legend,
  children,
}: {
  titulo: string;
  subtitulo: string;
  fecha: string;
  filename: string;
  onClose: () => void;
  chartHeightClass?: string;
  chartFullscreenClass?: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-root]")) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const toggleFullscreen = () => {
    setMenuOpen(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (cardRef.current) {
      void cardRef.current.requestFullscreen();
    }
  };

  const descargar = async (formato: "png" | "jpg") => {
    setMenuOpen(false);
    if (!cardRef.current || descargando) return;
    setDescargando(true);
    try {
      const opts = { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true };
      const url =
        formato === "png"
          ? await toPng(cardRef.current, opts)
          : await toJpeg(cardRef.current, { ...opts, quality: 0.95 });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${formato}`;
      a.click();
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`bg-white shadow-2xl border border-gray-300 relative flex flex-col text-gray-800 ${
        isFullscreen ? "w-screen h-screen rounded-none overflow-auto" : "w-[640px] max-w-[92vw] rounded-lg overflow-hidden"
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-2 right-3 text-gray-400 hover:text-gray-700 text-lg font-bold leading-none z-30"
      >
        ×
      </button>

      {/* Barra: fecha + opciones */}
      <div className="pt-3 px-4 pb-1 flex items-center justify-between text-[12px] text-gray-600">
        <span>Fecha: {fecha}</span>
        <div className="relative mt-3" data-menu-root>
          <button
            type="button"
            title="Opciones de gráfico"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 p-1 rounded"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path className="fill-current" d="M3 5h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded shadow-lg z-40 text-[12px] text-gray-700 overflow-hidden">
              <button type="button" onClick={toggleFullscreen} className="block w-full text-left px-3 py-2 hover:bg-gray-100">
                {isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              </button>
              <button
                type="button"
                onClick={() => descargar("png")}
                disabled={descargando}
                className="block w-full text-left px-3 py-2 hover:bg-gray-100 disabled:opacity-50"
              >
                {descargando ? "Generando…" : "Descargar PNG"}
              </button>
              <button
                type="button"
                onClick={() => descargar("jpg")}
                disabled={descargando}
                className="block w-full text-left px-3 py-2 hover:bg-gray-100 disabled:opacity-50"
              >
                {descargando ? "Generando…" : "Descargar JPG"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Título / subtítulo */}
      <div className="text-center px-8 mt-1">
        <h3 className="text-[14px] sm:text-[15px] font-extrabold text-gray-800 tracking-wide uppercase">{titulo}</h3>
        <p className="text-[11px] sm:text-[12px] text-gray-600 font-semibold tracking-wider uppercase mt-0.5">{subtitulo}</p>
      </div>

      {/* Gráfico */}
      <div className="relative px-3 pt-2">
        <div className={`w-full relative ${isFullscreen ? chartFullscreenClass : chartHeightClass}`}>{children}</div>
      </div>

      {/* Leyenda (opcional) */}
      {legend && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 pt-1 text-[11px] text-gray-700">
          {legend}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 mt-1 border-t border-gray-100 flex flex-col sm:flex-row justify-between text-[10px] text-gray-500 gap-1">
        <p className="italic">Nota: Información en tiempo casi real, sujeto a revisión y validación</p>
        <div className="sm:text-right leading-tight">
          <div>Fuente: <span className="font-medium text-gray-600">www.senamhi.gob.pe</span></div>
          <div>Fecha y hora del sistema <span className="font-medium text-gray-600">{new Date().toLocaleString("es-PE")}</span></div>
        </div>
      </div>
    </div>
  );
}
