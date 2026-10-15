"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getLatestMerged, getMockNow } from "@/lib/infra/data";
import { avisosActualizados } from "@/lib/infra/deteccionHoraria";
import { getStationsConfig } from "@/lib/infra/stationConfig";
import { getUmbralesActivos } from "@/lib/infra/umbrales";
import { getForecastInputs } from "@/lib/infra/catalogos";
import { detectarAvisos } from "@/lib/domain/deteccion";
import { filasPanel, grupoPronostico, HORAS_SIN_DATO, ordenarPorAtencion, type FilaPanel } from "@/lib/domain/panel";
import type { NivelAlerta } from "@/lib/domain/types";

const badgeNivel: Record<NivelAlerta, string> = {
  AMARILLO: "bg-[#ffeb3b] text-black",
  NARANJA: "bg-[#fca326] text-white",
  ROJO: "bg-[#ee3d43] text-white",
};

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "2026-10-01T09:00" → "Jue 01 oct 2026 · 09:00"
function fechaHora(f: string): string {
  const d = new Date(f);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

// "2026-10-07" → "07 oct"
function diaMes(f: string): string {
  return `${f.slice(8, 10)} ${MESES[Number(f.slice(5, 7)) - 1]}`;
}

// "2026-10-07T15:00" → "07 oct 15:00"
function diaMesHora(f: string): string {
  return `${diaMes(f)} ${f.slice(11, 16)}`;
}

// Tiempo restante legible: "6 d" o "18 h".
function restante(horas: number): string {
  return horas >= 24 ? `${Math.floor(horas / 24)} d` : `${Math.max(0, Math.round(horas))} h`;
}

function listaNombres(filas: FilaPanel[]): string {
  const n = filas.map((f) => f.station.estacion);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
}

interface Datos {
  ahora: string;
  filas: FilaPanel[];
}

export default function AdminDashboard() {
  // Inicializado vacío para evitar hydration mismatch (los overlays solo existen en el cliente).
  const [datos, setDatos] = useState<Datos | null>(null);

  useEffect(() => {
    const stations = getStationsConfig();
    const latest = getLatestMerged();
    const ahora = getMockNow();
    const filas = filasPanel({
      stations,
      alerts: avisosActualizados(),
      latest,
      deteccion: detectarAvisos(stations, latest, getUmbralesActivos, ahora),
      inputs: getForecastInputs(),
      ahora,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    setDatos({ ahora, filas: ordenarPorAtencion(filas) });
  }, []);

  if (!datos) {
    return <p className="text-sm text-slate-500">Cargando panel…</p>;
  }

  const { ahora, filas } = datos;
  const grupo = grupoPronostico(ahora);
  const grupoTxt = `${grupo[0].slice(8, 10)}–${diaMes(grupo[2])}`;

  const porPublicar = filas.filter((f) => f.pendiente);
  const vigentes = filas.filter((f) => f.aviso);
  const porNivel = (n: NivelAlerta) => vigentes.filter((f) => f.aviso!.nivel === n).length;
  const proximo = vigentes
    .filter((f) => f.vence !== null)
    .sort((a, b) => a.horasParaVencer! - b.horasParaVencer!);
  const proximoFin = proximo[0]?.vence;
  const vencenPrimero = proximo.filter((f) => f.vence === proximoFin);
  const normalizados = vigentes.filter((f) => f.rioNormal);
  const operativas = filas.filter((f) => !f.enMantenimiento);
  const sinDato = filas.filter((f) => f.sinDato);
  const sinPronostico = filas.filter((f) => f.pronosticoPendiente);
  const ultimoDato = filas.map((f) => f.ultimoDato).filter(Boolean).sort().at(-1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Panel de Administración</h1>
          <p className="text-sm text-slate-600">
            Sede de contingencia Junín · {filas.length} estaciones
          </p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 tabular-nums">
          Último dato: <b className="font-semibold text-slate-800">{ultimoDato ? fechaHora(ultimoDato) : "—"}</b>
        </p>
      </div>

      {/* Tarjetas de acción */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta
          titulo="Por publicar"
          franja={porPublicar.length > 0 ? "bg-[#ee3d43]" : "bg-green-600"}
          valor={porPublicar.length}
          href="/admin/avisos"
          accion="Revisar y publicar →"
        >
          {porPublicar.length === 0 ? (
            "Ninguna estación supera un umbral sin aviso vigente que lo cubra."
          ) : (
            <>
              {porPublicar.slice(0, 2).map((f) => (
                <span key={f.station.id} className="block">
                  <b className="font-semibold text-slate-800">{f.station.estacion}</b>: {f.pendiente!.accion}{" "}
                  aviso {f.pendiente!.nivel.toLowerCase()} de {f.pendiente!.tipo}
                  {f.avisoPendiente
                    ? ` (#${f.avisoPendiente.nro} espera aprobación)`
                    : f.modo === "automatico" && " (automática, en la próxima detección)"}
                </span>
              ))}
              {porPublicar.length > 2 && <span className="block">y {porPublicar.length - 2} más</span>}
            </>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Avisos vigentes"
          franja={porNivel("ROJO") ? "bg-[#ee3d43]" : vigentes.length ? "bg-[#fca326]" : "bg-green-600"}
          valor={vigentes.length}
          href="/admin/avisos"
          accion="Ver avisos →"
        >
          {vigentes.length > 0 && (
            <span className="mb-2 flex h-2 overflow-hidden rounded bg-slate-100" aria-hidden>
              {(["ROJO", "NARANJA", "AMARILLO"] as const).map((n) => (
                <span key={n} className={badgeNivel[n]} style={{ width: `${(porNivel(n) / vigentes.length) * 100}%` }} />
              ))}
            </span>
          )}
          <span className="block">
            {porNivel("ROJO")} rojo · {porNivel("NARANJA")} naranja · {porNivel("AMARILLO")} amarillo
          </span>
          {proximoFin && (
            <span className="block">
              El próximo vence el <b className="font-semibold text-slate-800">{diaMesHora(proximoFin)}</b> (
              {listaNombres(vencenPrimero)}).
            </span>
          )}
          {normalizados.length > 0 && (
            <span className="block text-sky-700">
              Río normalizado en {listaNombres(normalizados)}: puede deshabilitarse o dejar que venza.
            </span>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Sin dato reciente"
          franja={sinDato.length > 0 ? "bg-[#ee3d43]" : "bg-green-600"}
          valor={sinDato.length}
          total={operativas.length}
          href="/monitoreo"
          accion="Ver monitoreo →"
        >
          {sinDato.length === 0 ? (
            <>Todas las estaciones operativas reportaron en las últimas {HORAS_SIN_DATO} h.</>
          ) : (
            <>
              <b className="font-semibold text-slate-800">{listaNombres(sinDato)}</b> sin lectura hace más de{" "}
              {HORAS_SIN_DATO} h.
            </>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Pronóstico pendiente"
          franja={sinPronostico.length > 0 ? "bg-[#fca326]" : "bg-green-600"}
          valor={sinPronostico.length}
          total={operativas.length}
          href="/admin/pronostico"
          accion="Cargar pronóstico →"
        >
          {sinPronostico.length === 0 ? (
            <>Todas las estaciones tienen modelos para el grupo {grupoTxt}.</>
          ) : (
            <>
              <b className="font-semibold text-slate-800">{listaNombres(sinPronostico)}</b>{" "}
              {sinPronostico.length === 1 ? "no tiene" : "no tienen"} modelos completos para el grupo {grupoTxt}.
            </>
          )}
        </Tarjeta>
      </div>

      {/* Estado por estación */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-card">
        <p className="flex flex-wrap justify-between gap-2 border-b p-3 text-sm font-semibold">
          Estado por estación
          <span className="text-xs font-normal text-slate-500">ordenado por lo que requiere atención</span>
        </p>
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-2 pl-3">Estación</th>
              <th className="p-2">Aviso</th>
              <th className="p-2">Vence</th>
              <th className="p-2">Último dato</th>
              <th className="p-2">Pronóstico {grupoTxt}</th>
              <th className="p-2">Publicación</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.station.id} className="border-t whitespace-nowrap">
                <td className="p-2 pl-3">
                  <span className="font-semibold">{f.station.estacion}</span>
                  <span className="block text-xs text-slate-500">
                    {f.station.rio} · {f.station.departamento.join(", ")}
                  </span>
                </td>
                <td className="p-2">
                  {f.pendiente ? (
                    <Chip color="bg-[#ee3d43]" className="font-semibold text-red-700">
                      Por {f.pendiente.accion} · {f.pendiente.nivel.toLowerCase()}
                      {f.avisoPendiente && <span className="font-normal text-slate-500">#{f.avisoPendiente.nro} pendiente</span>}
                    </Chip>
                  ) : f.aviso ? (
                    <>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeNivel[f.aviso.nivel]}`}>
                        {f.aviso.nivel}
                      </span>{" "}
                      <span className="text-xs text-slate-500">#{f.aviso.nro}</span>
                      {f.rioNormal && (
                        <span className="ml-1.5 text-xs font-semibold text-sky-700" title="El último dato ya no supera umbral">
                          río normal
                        </span>
                      )}
                    </>
                  ) : (
                    <Chip color="bg-slate-300" className="text-slate-500">Normal</Chip>
                  )}
                </td>
                <td className="p-2">
                  {f.vence ? (
                    <>
                      {diaMesHora(f.vence)} <span className="text-xs text-slate-500">({restante(f.horasParaVencer!)})</span>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="p-2">
                  {f.enMantenimiento ? (
                    <Chip color="bg-slate-300" className="text-slate-500">Mantenimiento</Chip>
                  ) : f.ultimoDato ? (
                    <Chip color={f.sinDato ? "bg-[#ee3d43]" : "bg-green-600"} className={f.sinDato ? "font-semibold text-red-700" : ""}>
                      {f.ultimoDato.slice(0, 10) === ahora.slice(0, 10) ? f.ultimoDato.slice(11, 16) : fechaHora(f.ultimoDato)}
                    </Chip>
                  ) : (
                    <Chip color="bg-[#ee3d43]" className="font-semibold text-red-700">Sin datos</Chip>
                  )}
                </td>
                <td className="p-2">
                  {f.pronosticoPendiente ? (
                    <Chip color="bg-[#fca326]" className="font-semibold text-amber-700">
                      {f.diasConPronostico === 0 ? "Falta" : `${f.diasConPronostico} de 3 días`}
                    </Chip>
                  ) : f.enMantenimiento ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <Chip color="bg-green-600">{f.modelos} {f.modelos === 1 ? "modelo" : "modelos"}</Chip>
                  )}
                </td>
                <td className="p-2">{f.modo === "manual" ? "Manual" : "Automática"}</td>
                <td className="p-2 text-right">
                  <AccionFila f={f} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  franja,
  valor,
  total,
  href,
  accion,
  children,
}: {
  titulo: string;
  franja: string;
  valor: number;
  total?: number;
  href: string;
  accion: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-white p-4 pl-5 shadow-card">
      <span className={`absolute inset-y-0 left-0 w-1 ${franja}`} aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="text-3xl font-bold leading-none text-slate-800 tabular-nums">
        {valor}
        {total !== undefined && <span className="ml-1 text-sm font-semibold text-slate-400">de {total}</span>}
      </p>
      <div className="text-xs leading-relaxed text-slate-500">{children}</div>
      <Link href={href} className="mt-auto text-xs font-semibold text-primary-500 hover:underline">
        {accion}
      </Link>
    </div>
  );
}

function Chip({ color, className = "", children }: { color: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      {children}
    </span>
  );
}

function AccionFila({ f }: { f: FilaPanel }) {
  const cls = "text-xs font-semibold text-primary-500 hover:underline";
  if (f.pendiente) return <Link href="/admin/avisos" className={cls}>Publicar</Link>;
  if (f.pronosticoPendiente) return <Link href="/admin/pronostico" className={cls}>Cargar</Link>;
  if (f.aviso) return <Link href={`/avisos/${f.aviso.ca}-${f.aviso.ce}`} className={cls}>+Info</Link>;
  return null;
}
