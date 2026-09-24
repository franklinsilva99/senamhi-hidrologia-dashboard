"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { toPng, toJpeg } from "html-to-image";
import type { ForecastDiario, ForecastInput, Station } from "@/lib/types";

const C_ROJO = "#e60000";
const C_NARANJA = "#ff9900";
const C_AMARILLO = "#f9cf00";
const C_OBS = "#001eff";
const C_PRON = "#1d4ed8";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function fmtCorto(fecha: string): string {
  const d = new Date(fecha + "T00:00:00");
  if (isNaN(d.getTime())) return fecha;
  return `${d.getDate()}. ${MESES[d.getMonth()]}`;
}

function fmtLargo(fecha: string): string {
  const d = new Date(fecha + "T00:00:00");
  if (isNaN(d.getTime())) return fecha;
  return `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const num = (v?: number | null) => (v == null ? "—" : String(Number(Number(v).toFixed(2))));

type Umbrales = { amarilla: number; naranja: number; roja: number };

type Punto = {
  fecha: string;
  label: string;
  fechaLarga: string;
  real: number | null;
  pron: number | null;
  min?: number;
  max?: number;
  rango?: [number, number] | null;
};

function fila(color: string, txt: string, val: string) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
      <span className="text-gray-700">
        {txt}: <strong className="text-gray-950 font-bold">{val}</strong>
      </span>
    </div>
  );
}

// Contenido compartido por el tooltip de hover y la caja fija
function ContenidoTooltip({ punto, umbrales }: { punto: Punto; umbrales: Umbrales }) {
  return (
    <div className="bg-white/95 border border-[#4572a7] rounded shadow-md p-2 text-[11px] leading-tight pointer-events-none">
      <div className="font-bold text-gray-800 pb-1 mb-1 border-b border-gray-100">{punto.fechaLarga}</div>
      <div className="space-y-1">
        {fila(C_ROJO, "Rojo", num(umbrales.roja))}
        {fila(C_NARANJA, "Naranja", num(umbrales.naranja))}
        {fila(C_AMARILLO, "Amarillo", num(umbrales.amarilla))}
        {fila(C_PRON, "Min - Max", `${num(punto.min)} - ${num(punto.max)}`)}
        {fila(C_OBS, "Caudal Promedio", num(punto.real))}
        {fila(C_PRON, "Caudal Pronosticado", num(punto.pron))}
      </div>
    </div>
  );
}

function TooltipBox({
  active,
  payload,
  umbrales,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Punto }>;
  label?: string | number;
  umbrales: Umbrales;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload as Punto | undefined;
  if (!p) return null;
  return <ContenidoTooltip punto={p} umbrales={umbrales} />;
}

export default function HidrogramaPronosticoPopup({
  station,
  umbrales,
  forecast,
  inputs,
  onClose,
}: {
  station: Station;
  umbrales: Umbrales;
  forecast: ForecastDiario[];
  inputs: ForecastInput[];
  onClose: () => void;
}) {
  const hoyISO = new Date().toISOString().slice(0, 10);
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

  const minMaxPorDia = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const i of inputs) {
      if (!m.has(i.fecha)) m.set(i.fecha, []);
      m.get(i.fecha)!.push(i.valor);
    }
    return m;
  }, [inputs]);

  const data: Punto[] = useMemo(() => {
    const arr: Punto[] = forecast
      .map((f) => {
        const vals = minMaxPorDia.get(f.fecha) ?? [];
        const min = vals.length ? Math.min(...vals) : f.caudalPrevisto;
        const max = vals.length ? Math.max(...vals) : f.caudalPrevisto;
        const esPasado = f.fecha <= hoyISO;
        return {
          fecha: f.fecha,
          label: fmtCorto(f.fecha),
          fechaLarga: fmtLargo(f.fecha),
          real: esPasado ? f.caudalPrevisto : null,
          pron: esPasado ? null : f.caudalPrevisto,
          min,
          max,
          rango: esPasado ? null : ([min, max] as [number, number]),
        };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Encadena la línea punteada y la banda desde el último día pasado
    const lastPast = [...arr].reverse().find((d) => d.real != null);
    if (lastPast && arr.some((d) => d.pron != null)) {
      lastPast.pron = lastPast.real;
      if (lastPast.min != null && lastPast.max != null) {
        lastPast.rango = [lastPast.min, lastPast.max];
      }
    }
    return arr;
  }, [forecast, minMaxPorDia, hoyISO]);

  // Ventana: todos los días pronosticados (futuros); si son <6, se completan con pasados
  const nFuturos = forecast.filter((f) => f.fecha > hoyISO).length;
  const ventana = Math.max(6, nFuturos);
  const visibles = data.slice(-ventana);

  const valores = visibles.flatMap((d) => [d.real, d.pron, d.min, d.max]).filter((v): v is number => v != null);
  const yMax = Math.max(umbrales.roja, umbrales.naranja, umbrales.amarilla, ...valores) * 1.12;

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
      a.download = `hidrograma-${station.rio.toLowerCase()}-${hoyISO}.${formato}`;
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
        <span>Fecha: {hoyISO}</span>
        <div className="relative" data-menu-root>
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
        <h3 className="text-[14px] sm:text-[15px] font-extrabold text-gray-800 tracking-wide uppercase">
          Hidrograma de Caudal Pronosticado del Río {station.rio.toUpperCase()}
        </h3>
        <p className="text-[11px] sm:text-[12px] text-gray-600 font-semibold tracking-wider uppercase mt-0.5">
          Estación {station.estacion.toUpperCase()}
        </p>
      </div>

      {/* Gráfico */}
      <div className="relative px-3 pt-2">
        <div className={`w-full relative ${isFullscreen ? "h-[70vh]" : "h-[210px]"}`}>
          {/* Marca de agua SENAMHI (detrás) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-4xl font-black text-slate-900/[0.07] uppercase tracking-widest">Senamhi</span>
            <span className="mt-0.5 text-[7px] font-semibold tracking-wider text-slate-500/40 uppercase text-center">
              Servicio Nacional de Meteorología e Hidrología del Perú
            </span>
          </div>

          <ResponsiveContainer>
            <ComposedChart data={visibles} margin={{ top: 8, right: 34, left: 8, bottom: 4 }}>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" interval={0} tick={{ fontSize: 10, fill: "#4d4d4d" }} />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 10, fill: "#4d4d4d" }}
                tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(Number(v.toFixed(0))))}
                label={{ value: "CAUDAL(m3/s)", angle: -90, position: "insideLeft", offset: 6, style: { fontSize: 10, fill: "#4d4d4d" } }}
              />
              <Tooltip content={<TooltipBox umbrales={umbrales} />} />
              <ReferenceLine y={umbrales.roja} stroke={C_ROJO} strokeWidth={2} />
              <ReferenceLine y={umbrales.naranja} stroke={C_NARANJA} strokeWidth={2} />
              <ReferenceLine y={umbrales.amarilla} stroke={C_AMARILLO} strokeWidth={2} />
              <Area type="monotone" dataKey="rango" stroke="none" fill={C_PRON} fillOpacity={0.18} zIndex={500} />
              <Line type="monotone" dataKey="real" stroke={C_OBS} strokeWidth={2.2} dot={false} connectNulls={false} zIndex={500} />
              <Line type="monotone" dataKey="pron" stroke={C_PRON} strokeWidth={2.2} strokeDasharray="2 3" dot={false} connectNulls zIndex={500} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 pt-1 text-[11px] text-gray-700">
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: C_ROJO }} /> Rojo</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: C_NARANJA }} /> Naranja</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: C_AMARILLO }} /> Amarillo</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] inline-block" style={{ backgroundColor: C_OBS }} /> Caudal Promedio</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0 border-t-2 border-dashed inline-block" style={{ borderColor: C_PRON }} /> Caudal Pronosticado</span>
      </div>

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
