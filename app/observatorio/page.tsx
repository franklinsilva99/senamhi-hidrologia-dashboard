"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getLatestMerged, getMockNow, getSeriesMerged, loadAlerts } from "@/lib/infra/data";
import { getStationsConfig } from "@/lib/infra/stationConfig";
import { getUmbralesActivos } from "@/lib/infra/umbrales";
import { getForecastDiario } from "@/lib/infra/catalogos";
import { detectarAvisos } from "@/lib/domain/deteccion";
import { clasificarNivel, tipoReferencia, valoresDe } from "@/lib/domain/umbrales";
import type { Alert, DeteccionAviso, ForecastDiario, NivelAlerta, Observation, Station } from "@/lib/domain/types";
import type { Capa, PuntoMapa } from "@/components/observatorio/MapaObservatorio";
import {
  CarruselAvisos, COLOR_NIVEL, COLOR_NORMAL, EstadoRed, fechaCorta, Hidrograma72h,
  Pronostico3Dias, Proximamente, Tarjeta, TarjetaEstacion, UltimosAvisos,
} from "@/components/observatorio/Tarjetas";

// ── Observatorio: vitrina de los productos (aviso, monitoreo, pronóstico) ──
// Mosaico inspirado en observatorio.senamhi.gob.pe. Página aparte: no
// reemplaza a /avisos, /monitoreo ni /pronostico (enlaza a ellas).
// Las tarjetas están conectadas: seleccionar una estación (mapa, buscador o
// aviso) actualiza la tarjeta protagonista, el pronóstico y el hidrograma.

const MapaObservatorio = dynamic(() => import("@/components/observatorio/MapaObservatorio"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

type Area = "hidrologia" | "meteorologia";
const SEVERIDAD: Record<NivelAlerta, number> = { AMARILLO: 1, NARANJA: 2, ROJO: 3 };

const CAPAS: { id: Capa; icono: string; texto: string }[] = [
  { id: "monitoreo", icono: "📡", texto: "Monitoreo" },
  { id: "avisos", icono: "⚠️", texto: "Avisos" },
  { id: "pronostico", icono: "📅", texto: "Pronóstico" },
];

function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el reloj solo existe en el cliente (evita desajuste de hidratación)
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!ahora) return <div className="h-10 w-36" />;
  return (
    <div className="text-right">
      <p className="font-titulo text-xl font-extrabold tabular-nums text-slate-800">
        {ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-[11px] text-slate-500">
        {ahora.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </p>
    </div>
  );
}

export default function ObservatorioPage() {
  const [area, setArea] = useState<Area>("hidrologia");
  const [capa, setCapa] = useState<Capa>("monitoreo");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [datos, setDatos] = useState<{
    stations: Station[];
    latest: Record<string, Observation>;
    ahora: string;
    deteccion: DeteccionAviso[];
    avisos: Alert[];
    forecast: ForecastDiario[];
  } | null>(null);

  useEffect(() => {
    const stations = getStationsConfig();
    const latest = getLatestMerged();
    const ahora = getMockNow();
    const deteccion = detectarAvisos(stations, latest, getUmbralesActivos, ahora);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setDatos({ stations, latest, ahora, deteccion, avisos: loadAlerts(), forecast: getForecastDiario() });
    // Selección inicial: la estación con el estado más severo.
    const peor = [...deteccion].sort((a, b) => (b.umbral ? SEVERIDAD[b.umbral] : 0) - (a.umbral ? SEVERIDAD[a.umbral] : 0))[0];
    setSeleccionId(peor?.stationId ?? stations[0]?.id ?? null);
  }, []);

  const vista = useMemo(() => {
    if (!datos) return null;
    const { stations, latest, ahora, deteccion, avisos, forecast } = datos;
    const stationDe = (id: string) => stations.find((s) => s.id === id);
    const detDe = (id: string) => deteccion.find((d) => d.stationId === id);
    const vigentes = avisos.filter((a) => a.vigente).sort((a, b) => SEVERIDAD[b.nivel] - SEVERIDAD[a.nivel] || b.nro - a.nro);
    const avisoDe = (id: string) => vigentes.find((a) => a.stationId === id);
    const pronDe = (id: string) =>
      forecast.filter((f) => f.stationId === id && f.fecha > ahora.slice(0, 10)).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 3);

    const puntos: PuntoMapa[] = stations.map((s) => {
      const d = detDe(s.id);
      const obs = latest[s.id];
      const pref = s.preferencia ?? "caudal";
      if (capa === "monitoreo") {
        const c = d?.umbral ? COLOR_NIVEL[d.umbral] : COLOR_NORMAL;
        const v = obs ? (pref === "nivel" ? `${obs.nivel.toFixed(2)} m` : `${obs.caudal.toFixed(1)} m³/s`) : null;
        return { station: s, etiqueta: v, color: c.bg, texto: c.text };
      }
      if (capa === "avisos") {
        const a = avisoDe(s.id);
        const c = a ? COLOR_NIVEL[a.nivel] : null;
        return { station: s, etiqueta: a ? `Aviso N° ${a.nro}` : null, color: c?.bg ?? "#fff", texto: c?.text ?? "#000", halo: c?.bg ?? null };
      }
      const dias = pronDe(s.id);
      if (dias.length === 0) return { station: s, etiqueta: null, color: "#fff", texto: "#000" };
      const max = Math.max(...dias.map((x) => x.caudalPrevisto));
      const u = valoresDe(getUmbralesActivos(s.id, "caudal", ahora).avenida);
      const n = clasificarNivel(max, u, "avenida");
      const c = n ? COLOR_NIVEL[n] : COLOR_NORMAL;
      return { station: s, etiqueta: `máx ${max.toFixed(0)} m³/s`, color: c.bg, texto: c.text };
    });

    const conteo = { normal: 0, AMARILLO: 0, NARANJA: 0, ROJO: 0 };
    for (const d of deteccion) conteo[d.umbral ?? "normal"]++;

    const sel = (seleccionId && stationDe(seleccionId)) || stations[0];
    const pref = sel.preferencia ?? "caudal";
    const serie = getSeriesMerged(sel.id);
    const activos = getUmbralesActivos(sel.id, pref, ahora);
    const obsSel = latest[sel.id];
    const valorSel = obsSel ? (pref === "nivel" ? obsSel.nivel : obsSel.caudal) : undefined;
    const tipoSel = tipoReferencia(valorSel, activos);
    const umbralesSel = valoresDe(activos[tipoSel]);
    const hace6 = serie.length > 6 ? serie[serie.length - 7] : null;
    const tendencia = obsSel && hace6
      ? (((pref === "nivel" ? obsSel.nivel : obsSel.caudal) - (pref === "nivel" ? hace6.nivel : hace6.caudal)) /
          Math.max(1e-6, pref === "nivel" ? hace6.nivel : hace6.caudal)) * 100
      : null;
    const uAvenidaCaudal = valoresDe(getUmbralesActivos(sel.id, "caudal", ahora).avenida);
    const avisoSel = avisoDe(sel.id);
    const pobladosSel = capa === "avisos" && avisoSel
      ? (sel.pobladosGeo ?? []).filter((p) => avisoSel.poblados.includes(p.nombre))
      : [];

    return {
      stations, vigentes, puntos, conteo, sel, pref, serie, umbralesSel, tendencia, obsSel,
      detSel: detDe(sel.id), pobladosSel,
      dias: pronDe(sel.id).map((f) => ({ fecha: f.fecha, valor: f.caudalPrevisto })),
      clasificarPron: (v: number) => clasificarNivel(v, uAvenidaCaudal, "avenida"),
      ultimos: [...avisos].sort((a, b) => b.nro - a.nro).slice(0, 5),
      nombreDe: (id: string) => stationDe(id)?.estacion ?? id,
      fechaDato: `${fechaCorta(ahora)} ${ahora.slice(11, 16)}`,
    };
  }, [datos, capa, seleccionId]);

  const sugerencias = vista && busqueda.trim()
    ? vista.stations.filter((s) =>
        `${s.estacion} ${s.rio} ${s.cuenca} ${s.departamento.join(" ")}`.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : [];

  return (
    <div className="tema-senamhi min-h-screen bg-[#eef2f6] text-slate-800">
      {/* Cabecera institucional */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-red-600 text-xs">🇵🇪</div>
            <div className="text-[11px] leading-tight">
              <p className="font-bold text-red-700">PERÚ</p>
              <p className="text-slate-500">Ministerio del Ambiente</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG estático */}
          <img src="/brand/logo-senamhi.svg" alt="SENAMHI" className="h-10 w-auto" />
          <div className="min-w-0">
            <h1 className="text-base font-extrabold uppercase tracking-tight text-[#0b6e4f] sm:text-lg">
              Observatorio Hidrometeorológico · Contingencia
            </h1>
            <p className="text-xs text-slate-500">Servicio Nacional de Meteorología e Hidrología del Perú</p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {vista && (
              <div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 sm:flex">
                <span className="text-2xl">💧</span>
                <div className="leading-tight">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Datos al</p>
                  <p className="text-xs font-bold text-slate-700">{vista.fechaDato}</p>
                </div>
              </div>
            )}
            <Reloj />
          </div>
        </div>

        {/* Áreas */}
        <nav className="border-t border-slate-100">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-5 py-2">
            {([
              { id: "hidrologia", icono: "💧", texto: "Hidrología" },
              { id: "meteorologia", icono: "☁️", texto: "Meteorología" },
            ] as const).map((a) => (
              <button
                key={a.id}
                onClick={() => setArea(a.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-all ${
                  area === a.id ? "bg-gradient-to-r from-[#0b6e99] to-[#14b8a6] text-white shadow-md" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span>{a.icono}</span>
                {a.texto}
              </button>
            ))}
            {vista && vista.vigentes.length > 0 && (
              <Link
                href="/avisos"
                className="ml-auto animate-pulse rounded-full bg-red-600 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-md hover:animate-none hover:bg-red-700"
              >
                ⚠ {vista.vigentes.length} avisos vigentes
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-5">
        {area === "meteorologia" ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-r from-primary-500 to-[#0b6e99] p-6 text-white shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Meteorología</p>
              <h2 className="mt-1 text-2xl font-extrabold">Los productos meteorológicos llegan pronto</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/85">
                Aviso, monitoreo y pronóstico meteorológico se integrarán en este mismo observatorio, con la misma lógica que hoy
                funciona para hidrología.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Proximamente icono="⚠️" titulo="Aviso meteorológico" texto="Avisos por lluvias, heladas, vientos y temperaturas extremas, con su nivel de peligro y vigencia.">
                <div className="absolute right-4 top-6 h-24 w-24 rounded-full border-[10px] border-[#fca326] border-b-transparent border-l-[#ffeb3b] border-r-[#ee3d43]" />
              </Proximamente>
              <Proximamente icono="🌡️" titulo="Monitoreo meteorológico" texto="Temperatura, humedad, precipitación y viento de las estaciones, en el mapa y en tiempo casi real.">
                <div className="absolute inset-x-6 bottom-6 h-16 rounded-xl bg-gradient-to-r from-violet-500 via-sky-400 via-50% to-red-500" />
              </Proximamente>
              <Proximamente icono="🌦️" titulo="Pronóstico meteorológico" texto="Pronóstico de 3 días por distrito: temperatura máxima y mínima, lluvia y condiciones del cielo.">
                <div className="absolute right-6 top-8 flex gap-3 text-4xl"><span>☀️</span><span>⛅</span><span>🌧️</span></div>
              </Proximamente>
            </div>
          </div>
        ) : !vista ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="h-[600px] animate-pulse rounded-2xl bg-white lg:col-span-3" />
            <div className="h-[600px] animate-pulse rounded-2xl bg-white lg:col-span-6" />
            <div className="h-[600px] animate-pulse rounded-2xl bg-white lg:col-span-3" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Estación protagonista */}
            <div className="lg:col-span-3">
              <TarjetaEstacion
                station={vista.sel}
                obs={vista.obsSel}
                nivel={vista.detSel?.umbral ?? null}
                tendencia={vista.tendencia}
                umbralRojo={vista.umbralesSel.roja}
                preferencia={vista.pref}
                fechaDato={vista.fechaDato}
              />
            </div>

            {/* Buscador + mapa */}
            <div className="flex flex-col gap-3 lg:col-span-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar estación, río, cuenca o departamento…"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  {sugerencias.length > 0 && (
                    <ul className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {sugerencias.map((s) => (
                        <li key={s.id}>
                          <button
                            onClick={() => { setSeleccionId(s.id); setBusqueda(""); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            <span className="font-semibold">{s.estacion}</span>
                            <span className="text-xs text-slate-500">Río {s.rio} · {s.departamento.join(", ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="relative h-[560px] overflow-hidden rounded-2xl shadow-card">
                {/* Capas por producto */}
                <div className="absolute left-3 top-3 z-[500] flex gap-1 rounded-full bg-white/95 p-1 shadow-md">
                  {CAPAS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCapa(c.id)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase transition-all ${
                        capa === c.id ? "bg-gradient-to-r from-[#0b6e99] to-[#14b8a6] text-white" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <span>{c.icono}</span>
                      {c.texto}
                    </button>
                  ))}
                </div>

                <MapaObservatorio
                  puntos={vista.puntos}
                  seleccionId={vista.sel.id}
                  onSeleccionar={setSeleccionId}
                  poblados={vista.pobladosSel}
                />

                {/* Leyenda */}
                <div className="absolute bottom-3 right-3 z-[500] rounded-xl bg-white/95 p-3 text-[11px] shadow-md">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {capa === "monitoreo" ? "Estado actual" : capa === "avisos" ? "Nivel del aviso" : "Pronóstico (máx. 3 días)"}
                  </p>
                  {[COLOR_NORMAL, COLOR_NIVEL.AMARILLO, COLOR_NIVEL.NARANJA, COLOR_NIVEL.ROJO]
                    .filter((c) => capa !== "avisos" || c !== COLOR_NORMAL)
                    .map((c) => (
                      <p key={c.nombre} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm" style={{ background: c.bg, border: `1px solid ${c.borde}` }} /> {c.nombre}
                      </p>
                    ))}
                  {capa === "avisos" && (
                    <p className="mt-1 flex items-center gap-2 text-slate-500">
                      <span className="h-3 w-3 rounded-full bg-[#16a34a]" /> Centro poblado
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Avisos + estado de la red */}
            <div className="flex flex-col gap-4 lg:col-span-3">
              <CarruselAvisos
                avisos={vista.vigentes}
                nombreDe={vista.nombreDe}
                onVerMapa={(a) => { setCapa("avisos"); setSeleccionId(a.stationId); }}
              />
              <EstadoRed conteo={vista.conteo} />
              <Tarjeta titulo="Aviso meteorológico" icono="☁️">
                <p className="text-xs text-slate-500">
                  <span className="mr-1.5 rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-secondary-700">Próximamente</span>
                  Se integrará en la pestaña Meteorología.
                </p>
              </Tarjeta>
            </div>

            {/* Fila inferior */}
            <div className="lg:col-span-3">
              <Pronostico3Dias dias={vista.dias} clasificar={vista.clasificarPron} estacion={vista.sel.estacion} />
            </div>
            <div className="lg:col-span-5">
              <Hidrograma72h serie={vista.serie} preferencia={vista.pref} umbrales={vista.umbralesSel} estacion={vista.sel.estacion} />
            </div>
            <div className="lg:col-span-4">
              <UltimosAvisos avisos={vista.ultimos} nombreDe={vista.nombreDe} />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-5 py-3 text-xs text-slate-500">
          <p>© 2026 SENAMHI · Servicio Nacional de Meteorología e Hidrología del Perú · Contingencia DHI</p>
          <nav className="ml-auto flex gap-4 font-bold uppercase tracking-wide">
            <Link href="/avisos" className="hover:text-primary-500">Avisos</Link>
            <Link href="/monitoreo" className="hover:text-primary-500">Monitoreo</Link>
            <Link href="/pronostico" className="hover:text-primary-500">Pronóstico</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
