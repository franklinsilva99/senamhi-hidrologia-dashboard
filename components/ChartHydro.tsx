"use client";
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ReferenceArea, ResponsiveContainer, Brush,
} from "recharts";
import ChartTooltip from "@/components/ChartTooltip";
import type { Observation, TipoAviso } from "@/lib/types";

const C_AMARILLO = "#ffeb3b";
const C_NARANJA = "#fca326";
const C_ROJO = "#ee3d43";
const C_LINEA = "#0000ff";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Formato real SENAMHI: en 00:00 → "9. Sep"; en 12:00 → "12:00"
function formatTick(fecha: string): string {
  const d = new Date(fecha.replace(" ", "T"));
  if (isNaN(d.getTime())) return fecha;
  const h = d.getHours();
  if (h === 0) return `${d.getDate()}. ${MESES[d.getMonth()]}`;
  return `${String(h).padStart(2, "0")}:00`;
}

// Eje Y: hasta 2 decimales (recorta ceros: 60.00 → 60, 3201.50 → 3201.5)
function formatAxisNum(v: number): string {
  return String(Number(Number(v).toFixed(2)));
}

export default function ChartHydro({
  series, preferencia = "caudal", tipo = "avenida", cota = null,
  umbralAmarilla, umbralNaranja, umbralRoja, navigator = false,
}: {
  series: Observation[];
  preferencia?: "caudal" | "nivel";
  tipo?: TipoAviso;
  cota?: number | null;
  umbralAmarilla?: number;
  umbralNaranja?: number;
  umbralRoja?: number;
  navigator?: boolean;
}) {
  const isNivel = preferencia === "nivel";
  const tieneCota = isNivel && cota != null;
  const offset = tieneCota ? (cota as number) : 0;
  const unidad = isNivel ? (tieneCota ? "m.s.n.m." : "m") : "m³/s";
  const varName = isNivel ? "Nivel" : "Caudal";

  const realData = series.map((o) => ({
    fecha: o.fecha,
    valor: (isNivel ? o.nivel : o.caudal) + offset,
  }));

  // Puntos fantasma al final: las bandas llegan al borde derecho pero la línea termina antes
  const PHANTOM_HORAS = 6;
  const data: { fecha: string; valor: number | null }[] = [...realData];
  if (realData.length > 0) {
    const last = new Date(realData[realData.length - 1].fecha.replace(" ", "T"));
    for (let i = 1; i <= PHANTOM_HORAS; i++) {
      const d = new Date(last.getTime() + i * 3600 * 1000);
      data.push({ fecha: d.toISOString().slice(0, 16), valor: null });
    }
  }

  // Ticks: inicios de día (00:00 → etiqueta de fecha) y mediodía (12:00 → hora)
  const ticks = realData
    .map((d) => d.fecha)
    .filter((f) => f.endsWith("T00:00") || f.endsWith("T12:00"));

  const a = (umbralAmarilla ?? 0) + offset;
  const n = (umbralNaranja ?? 0) + offset;
  const r = (umbralRoja ?? 0) + offset;

  const valores = realData.map((d) => d.valor);
  const dMin = valores.length ? Math.min(...valores) : a;
  const dMax = valores.length ? Math.max(...valores) : r;
  const pad = 0.05 * Math.abs(r - a) || Math.abs(r) * 0.02 || 1;
  // El rojo no tiene tope (solo inicio de peligro) → siempre más ancho (1.4× el naranja)
  const bottom = tipo === "vigilancia" ? r - 1.4 * (n - r) : Math.min(dMin, a) - pad;
  const top = tipo === "vigilancia" ? Math.max(dMax, a) + pad : r + 1.4 * (r - n);

  return (
    <div className="h-64 w-full relative">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <XAxis
            dataKey="fecha"
            ticks={ticks}
            interval={0}
            tickFormatter={formatTick}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            domain={[bottom, top]}
            tickFormatter={formatAxisNum}
            tick={{ fontSize: 10 }}
            label={{
              value: `${varName} (${unidad})`,
              angle: -90,
              position: "insideLeft",
              offset: 0,
              style: { fontSize: 10, fill: "#64748b" },
            }}
          />
          <Tooltip content={<ChartTooltip varName={varName} unidad={unidad} a={a} n={n} r={r} />} />

          {/* Bandas de umbral — avenida vs vigilancia */}
          {tipo === "vigilancia" ? (
            <>
              <ReferenceArea y1={bottom} y2={r} fill={C_ROJO} fillOpacity={0.85} stroke="none" />
              <ReferenceArea y1={r} y2={n} fill={C_NARANJA} fillOpacity={0.85} stroke="none" />
              <ReferenceArea y1={n} y2={a} fill={C_AMARILLO} fillOpacity={0.85} stroke="none" />
            </>
          ) : (
            <>
              <ReferenceArea y1={a} y2={n} fill={C_AMARILLO} fillOpacity={0.85} stroke="none" />
              <ReferenceArea y1={n} y2={r} fill={C_NARANJA} fillOpacity={0.85} stroke="none" />
              <ReferenceArea y1={r} y2={top} fill={C_ROJO} fillOpacity={0.85} stroke="none" />
            </>
          )}

          <Line type="monotone" dataKey="valor" name={varName} stroke={C_LINEA} fill="none" strokeWidth={1.5} dot={false} connectNulls={false} />

          {navigator && (
            <Brush dataKey="fecha" height={26} travellerWidth={8} stroke="#94a3b8" fill="#eef2f7" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-4xl font-black text-slate-900/[0.07] select-none uppercase tracking-widest">
          SENAMHI
        </span>
      </div>
    </div>
  );
}
