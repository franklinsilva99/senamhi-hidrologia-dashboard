"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Alert, NivelAlerta, Observation, Station, Umbrales } from "@/lib/domain/types";

// ── Tarjetas del observatorio (mosaico) ──

export const COLOR_NIVEL: Record<NivelAlerta, { bg: string; text: string; nombre: string; borde: string }> = {
  AMARILLO: { bg: "#ffeb3b", text: "#000", nombre: "Amarillo", borde: "#e5c800" },
  NARANJA: { bg: "#fca326", text: "#fff", nombre: "Naranja", borde: "#e08a10" },
  ROJO: { bg: "#ee3d43", text: "#fff", nombre: "Rojo", borde: "#c9282e" },
};
// Normal = blanco (mismo criterio que el mapa de monitoreo); el borde gris lo
// hace visible sobre fondos claros.
export const COLOR_NORMAL = { bg: "#ffffff", text: "#0f172a", nombre: "Normal", borde: "#94a3b8" };

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
function diaSemana(iso: string): string {
  return DIAS[new Date(`${iso.slice(0, 10)}T00:00:00`).getDay()];
}

// Contenedor común de las tarjetas.
export function Tarjeta({
  titulo, icono, accion, children, className = "",
}: {
  titulo?: string;
  icono?: string;
  accion?: { href: string; texto: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col rounded-2xl bg-white p-4 shadow-card ${className}`}>
      {titulo && (
        <header className="mb-3 flex items-center gap-2">
          {icono && <span className="text-base">{icono}</span>}
          <h3 className="text-xs font-bold uppercase tracking-wide text-primary-500">{titulo}</h3>
          {accion && (
            <Link href={accion.href} className="ml-auto text-[11px] font-semibold text-primary-400 hover:text-primary-500">
              {accion.texto} →
            </Link>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

// Medidor semicircular del nivel de alerta (amarillo → naranja → rojo).
export function Medidor({ nivel, size = 96 }: { nivel: NivelAlerta | null; size?: number }) {
  const ang = { AMARILLO: -60, NARANJA: 0, ROJO: 60 } as const;
  const rot = nivel ? ang[nivel] : -90;
  const arco = (a0: number, a1: number) => {
    const p = (a: number) => [50 + 40 * Math.cos(((a - 180) * Math.PI) / 180), 50 + 40 * Math.sin(((a - 180) * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M ${x0} ${y0} A 40 40 0 0 1 ${x1} ${y1}`;
  };
  return (
    <svg viewBox="0 0 100 58" width={size} aria-label={`Nivel ${nivel ?? "normal"}`}>
      <path d={arco(0, 60)} stroke="#ffeb3b" strokeWidth="10" fill="none" />
      <path d={arco(61, 120)} stroke="#fca326" strokeWidth="10" fill="none" />
      <path d={arco(121, 180)} stroke="#ee3d43" strokeWidth="10" fill="none" />
      <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: "50px 50px", transition: "transform 900ms cubic-bezier(.34,1.56,.64,1)" }}>
        <line x1="50" y1="50" x2="50" y2="18" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="5.5" fill="#fff" stroke="#0f172a" strokeWidth="3" />
    </svg>
  );
}

// Mini indicador de la tarjeta protagonista.
function Mini({ etq, val, uni }: { etq: string; val: string; uni?: string }) {
  return (
    <div className="rounded-xl bg-white/12 p-3 ring-1 ring-white/15 backdrop-blur-sm">
      <p className="text-[11px] font-semibold text-white/80">{etq}</p>
      <p className="mt-0.5 text-xl font-extrabold text-white">
        {val} {uni && <span className="text-xs font-semibold text-white/80">{uni}</span>}
      </p>
    </div>
  );
}

// Tarjeta protagonista: la estación seleccionada.
export function TarjetaEstacion({
  station, obs, nivel, tendencia, umbralRojo, preferencia, fechaDato,
}: {
  station: Station;
  obs: Observation | undefined;
  nivel: NivelAlerta | null;
  tendencia: number | null; // % de cambio en 6 h
  umbralRojo: number | undefined;
  preferencia: "caudal" | "nivel";
  fechaDato: string;
}) {
  const [info, setInfo] = useState(false);
  const fondo: Record<string, string> = {
    normal: "from-[#0b6e99] via-[#0e8aa8] to-[#14b8a6]",
    AMARILLO: "from-[#a16207] via-[#ca8a04] to-[#eab308]",
    NARANJA: "from-[#c2410c] via-[#ea580c] to-[#f59e0b]",
    ROJO: "from-[#991b1b] via-[#dc2626] to-[#f97316]",
  };
  const esNivel = preferencia === "nivel";
  const valor = obs ? (esNivel ? obs.nivel : obs.caudal) : null;
  const unidad = esNivel ? "m" : "m³/s";
  const c = nivel ? COLOR_NIVEL[nivel] : COLOR_NORMAL;
  return (
    <section className={`flex flex-col rounded-2xl bg-gradient-to-br ${fondo[nivel ?? "normal"]} p-5 text-white shadow-card transition-colors duration-700`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Hidrología en</p>
      <h2 className="text-xl font-extrabold uppercase leading-tight">{station.estacion}</h2>
      <p className="text-xs text-white/80">Río {station.rio} · {station.dz ?? "—"}</p>
      <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Dato al {fechaDato}
      </span>

      <div className="mt-4 flex items-end gap-2">
        <p className="font-titulo text-6xl font-extrabold leading-none tracking-tight">{valor != null ? valor.toFixed(esNivel ? 2 : 1) : "—"}</p>
        <p className="pb-1 text-lg font-bold text-white/90">{unidad}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: c.bg, color: c.text, border: `1px solid ${c.borde}` }}>
          ● {c.nombre}
        </span>
        <span className="text-xs text-white/85">{esNivel ? "Nivel" : "Caudal"} actual</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Mini etq="💧 Caudal" val={obs ? obs.caudal.toFixed(1) : "—"} uni="m³/s" />
        <Mini etq="📏 Nivel" val={obs ? obs.nivel.toFixed(2) : "—"} uni="m" />
        <Mini etq="🔴 Umbral rojo" val={umbralRojo != null ? String(umbralRojo) : "—"} uni={umbralRojo != null ? unidad : undefined} />
        <Mini
          etq="📈 Tendencia 6 h"
          val={tendencia == null ? "—" : `${tendencia > 0 ? "↑" : tendencia < 0 ? "↓" : "→"} ${Math.abs(tendencia).toFixed(1)}%`}
        />
      </div>

      <div className="mt-4 rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Cuenca</p>
        <p className="text-sm font-bold uppercase">{station.cuenca}</p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/70">Cobertura</p>
        <p className="text-sm font-semibold">{station.departamento.join(", ")} · {station.poblados.length} centro(s) poblado(s)</p>
      </div>

      <button onClick={() => setInfo((v) => !v)} className="mt-3 w-fit text-[11px] font-bold uppercase tracking-wide text-white/85 hover:text-white">
        ⓘ Sobre este dato {info ? "▴" : "▾"}
      </button>
      {info && (
        <p className="mt-1 text-[11px] leading-snug text-white/85">
          Última lectura horaria de los productos «Caudales horarios» y «Niveles vigilados horario». El estado se calcula comparando
          la variable preferida de la estación ({esNivel ? "nivel" : "caudal"}) con sus umbrales de avenida y vaciante activos.
        </p>
      )}
    </section>
  );
}

// Carrusel de avisos vigentes con medidor de nivel.
export function CarruselAvisos({
  avisos, nombreDe, onVerMapa,
}: {
  avisos: Alert[];
  nombreDe: (stationId: string) => string;
  onVerMapa: (a: Alert) => void;
}) {
  const [i, setI] = useState(0);
  if (avisos.length === 0) {
    return (
      <Tarjeta titulo="Avisos hidrológicos" icono="✅">
        <p className="text-sm text-slate-600">Sin avisos hidrológicos vigentes.</p>
      </Tarjeta>
    );
  }
  const idx = Math.min(i, avisos.length - 1);
  const a = avisos[idx];
  const c = COLOR_NIVEL[a.nivel];
  return (
    <section
      className="flex flex-col rounded-2xl p-4 shadow-card"
      style={{ background: `linear-gradient(135deg, ${c.bg}33 0%, #ffffff 55%)` }}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="rounded px-2 py-0.5 font-extrabold uppercase" style={{ background: c.bg, color: c.text }}>▲ {c.nombre}</span>
        <span className="font-semibold text-slate-600">Aviso N° {a.nro}</span>
        <span className="ml-auto text-slate-500">{avisos.length} vigente(s)</span>
      </div>
      <div className="mt-2 flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-3 text-sm font-extrabold uppercase leading-snug text-slate-800">{a.titulo}</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            📅 {fechaCorta(a.inicio)} → {fechaCorta(a.fin)} · {nombreDe(a.stationId)} · {a.tipo === "vaciante" ? "Vaciante ↓" : "Avenida ↑"}
          </p>
        </div>
        <Medidor nivel={a.nivel} size={84} />
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">{a.descripcion}</p>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-200/70 pt-3">
        <button
          onClick={() => onVerMapa(a)}
          className="rounded-full border border-red-300 px-3 py-1 text-[11px] font-bold uppercase text-red-600 hover:bg-red-50"
        >
          📍 Ver en el mapa
        </button>
        <Link href={`/avisos/${a.ca}-${a.ce}`} className="text-[11px] font-semibold text-primary-400 hover:text-primary-500">Detalle →</Link>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setI((idx - 1 + avisos.length) % avisos.length)} className="rounded-full px-1.5 text-slate-500 hover:bg-slate-100" aria-label="Anterior">‹</button>
          {avisos.map((_, k) => (
            <span key={k} className={`h-1 rounded-full transition-all ${k === idx ? "w-5 bg-red-500" : "w-2 bg-slate-300"}`} />
          ))}
          <span className="text-[11px] text-slate-500">{idx + 1}/{avisos.length}</span>
          <button onClick={() => setI((idx + 1) % avisos.length)} className="rounded-full px-1.5 text-slate-500 hover:bg-slate-100" aria-label="Siguiente">›</button>
        </div>
      </div>
    </section>
  );
}

// Anillo con el estado de la red de estaciones.
export function EstadoRed({ conteo }: { conteo: { normal: number; AMARILLO: number; NARANJA: number; ROJO: number } }) {
  const items = [
    { k: "normal", ...COLOR_NORMAL, n: conteo.normal },
    { k: "AMARILLO", ...COLOR_NIVEL.AMARILLO, n: conteo.AMARILLO },
    { k: "NARANJA", ...COLOR_NIVEL.NARANJA, n: conteo.NARANJA },
    { k: "ROJO", ...COLOR_NIVEL.ROJO, n: conteo.ROJO },
  ];
  const total = items.reduce((s, x) => s + x.n, 0) || 1;
  const L = 2 * Math.PI * 34;
  let acc = 0;
  return (
    <Tarjeta titulo="Estado de la red" icono="📡" accion={{ href: "/monitoreo", texto: "Monitoreo" }}>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 90 90" width="96" className="-rotate-90">
          {/* Contorno gris: hace visible el tramo blanco (Normal) */}
          <circle cx="45" cy="45" r="34" fill="none" stroke="#cbd5e1" strokeWidth="14" />
          <circle cx="45" cy="45" r="34" fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {items.map((x) => {
            const len = (x.n / total) * L;
            const el = (
              <circle key={x.k} cx="45" cy="45" r="34" fill="none" stroke={x.bg} strokeWidth="12"
                strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-acc} style={{ transition: "stroke-dasharray 800ms ease" }} />
            );
            acc += len;
            return el;
          })}
        </svg>
        <ul className="space-y-1 text-xs">
          {items.map((x) => (
            <li key={x.k} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.bg, border: `1px solid ${x.borde}` }} />
              <span className="w-16 text-slate-600">{x.nombre}</span>
              <span className="font-bold text-slate-800">{x.n}</span>
            </li>
          ))}
          <li className="pt-1 text-[11px] text-slate-400">{total} estaciones</li>
        </ul>
      </div>
    </Tarjeta>
  );
}

// Pronóstico de 3 días de la estación seleccionada.
export function Pronostico3Dias({
  dias, clasificar, estacion,
}: {
  dias: { fecha: string; valor: number }[];
  clasificar: (v: number) => NivelAlerta | null;
  estacion: string;
}) {
  return (
    <Tarjeta titulo="Pronóstico 3 días" icono="📅" accion={{ href: "/pronostico", texto: "Pronóstico" }}>
      <p className="-mt-2 mb-2 text-[11px] text-slate-500">Caudal previsto · {estacion}</p>
      {dias.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-xs text-slate-400">
          Sin pronóstico para esta estación.
        </p>
      ) : (
        <div className="grid flex-1 grid-cols-3 divide-x divide-slate-100">
          {dias.map((d, k) => {
            const n = clasificar(d.valor);
            const c = n ? COLOR_NIVEL[n] : COLOR_NORMAL;
            return (
              <div key={d.fecha} className="flex flex-col items-center gap-1 px-1 py-2">
                <p className="text-sm font-bold text-slate-800">{k === 0 ? "Mañana" : diaSemana(d.fecha)}</p>
                <p className="text-[11px] text-slate-400">{fechaCorta(d.fecha)}</p>
                <span className="my-1 text-3xl drop-shadow-sm" style={{ filter: n ? `drop-shadow(0 0 6px ${c.bg})` : undefined }}>💧</span>
                <p className="text-2xl font-extrabold text-slate-800">{d.valor.toFixed(0)}</p>
                <p className="text-[10px] text-slate-400">m³/s</p>
                <span className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: c.bg, color: c.text, border: `1px solid ${c.borde}` }}>{c.nombre}</span>
              </div>
            );
          })}
        </div>
      )}
    </Tarjeta>
  );
}

// Hidrograma de las últimas 72 h (variable preferida) con umbrales.
export function Hidrograma72h({
  serie, preferencia, umbrales, estacion,
}: {
  serie: Observation[];
  preferencia: "caudal" | "nivel";
  umbrales: Partial<Umbrales>;
  estacion: string;
}) {
  const esNivel = preferencia === "nivel";
  const data = serie.map((o) => ({ f: o.fecha.slice(5, 13).replace("T", " ").replace(" ", " ") + "h", v: esNivel ? o.nivel : o.caudal }));
  const valores = data.map((d) => d.v).concat(Object.values(umbrales).filter((x): x is number => x != null));
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pad = (max - min) * 0.1 || 1;
  return (
    <Tarjeta titulo="Hidrograma 72 h" icono="〰️" accion={{ href: "/monitoreo", texto: "Ver completo" }}>
      <p className="-mt-2 mb-1 text-[11px] text-slate-500">{esNivel ? "Nivel (m)" : "Caudal (m³/s)"} · {estacion}</p>
      <div className="h-44 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="obs-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e8aa8" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#0e8aa8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="f" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={23} tickLine={false} axisLine={false} />
            <YAxis domain={[min - pad, max + pad]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => String(Number(v.toFixed(esNivel ? 2 : 0)))} />
            <Tooltip formatter={(v) => [Number(v).toFixed(2), esNivel ? "Nivel (m)" : "Caudal (m³/s)"]} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            {umbrales.amarilla != null && <ReferenceLine y={umbrales.amarilla} stroke="#eab308" strokeDasharray="4 3" />}
            {umbrales.naranja != null && <ReferenceLine y={umbrales.naranja} stroke="#fca326" strokeDasharray="4 3" />}
            {umbrales.roja != null && <ReferenceLine y={umbrales.roja} stroke="#ee3d43" strokeDasharray="4 3" />}
            <Area type="monotone" dataKey="v" stroke="#0b6e99" strokeWidth={2} fill="url(#obs-area)" isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Tarjeta>
  );
}

// Línea de tiempo de los últimos avisos emitidos.
export function UltimosAvisos({ avisos, nombreDe }: { avisos: Alert[]; nombreDe: (id: string) => string }) {
  return (
    <Tarjeta titulo="Últimos avisos" icono="🕒" accion={{ href: "/avisos", texto: "Todos" }}>
      <ol className="relative space-y-3 border-l-2 border-slate-100 pl-4">
        {avisos.map((a) => {
          const c = COLOR_NIVEL[a.nivel];
          return (
            <li key={`${a.ca}-${a.ce}`} className="relative">
              <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-2 ring-white" style={{ background: c.bg }} />
              <Link href={`/avisos/${a.ca}-${a.ce}`} className="group block">
                <p className="text-xs font-bold text-slate-800 group-hover:text-primary-400">
                  N° {a.nro} · {nombreDe(a.stationId)}
                  {a.vigente && <span className="ml-1.5 rounded bg-green-100 px-1 text-[9px] font-bold uppercase text-green-700">vigente</span>}
                </p>
                <p className="text-[11px] text-slate-500">
                  {c.nombre} · {a.tipo === "vaciante" ? "Vaciante" : "Avenida"} · {fechaCorta(a.inicio)} → {fechaCorta(a.fin)}
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
    </Tarjeta>
  );
}

// Tarjeta "Próximamente" (productos de meteorología).
export function Proximamente({ icono, titulo, texto, children }: { icono: string; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <section className="relative flex min-h-56 flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-card">
      <div className="pointer-events-none absolute inset-0 opacity-25 blur-[1.5px] grayscale-[30%]">{children}</div>
      <div className="relative">
        <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-secondary-700">Próximamente</span>
        <p className="mt-3 text-3xl">{icono}</p>
        <h3 className="mt-1 text-base font-extrabold text-primary-500">{titulo}</h3>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600">{texto}</p>
      </div>
    </section>
  );
}
