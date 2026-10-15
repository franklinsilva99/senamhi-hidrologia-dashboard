"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getStationsConfig, setStationConfig } from "@/lib/infra/stationConfig";
import { getUmbrales, resetUmbralesEstacion, setUmbralesEstacion } from "@/lib/infra/umbrales";
import { getMockNow } from "@/lib/infra/data";
import ModalCentrosPoblados from "@/components/ModalCentrosPoblados";
import { activosEn, haySolape, NIVELES, periodoCubre, TIPOS } from "@/lib/domain/umbrales";
import { UNIDAD_POR_VARIABLE } from "@/lib/domain/types";
import type { NivelUmbral, Station, TipoAviso, Umbral, UmbralesActivos, Variable } from "@/lib/domain/types";

// ── Configuración de estaciones: lista + panel de detalle ──
// El panel sigue el orden del flujo de avisos:
//   1. Detección (variable preferida)  2. Umbrales y vigencia  3. Publicación  4. Estación

const VARIABLES: Variable[] = ["caudal", "nivel"];
const VAR_LABEL: Record<Variable, string> = { caudal: "Caudal", nivel: "Nivel" };
const TIPO_LABEL: Record<TipoAviso, string> = { avenida: "Avenida ↑", vaciante: "Vaciante ↓" };
const TIPO_CLS: Record<TipoAviso, string> = {
  avenida: "bg-rose-50 text-rose-700",
  vaciante: "bg-sky-50 text-sky-700",
};
const NIVEL_LABEL: Record<NivelUmbral, string> = { amarilla: "Amarilla", naranja: "Naranja", roja: "Roja" };
const NIVEL_DOT: Record<NivelUmbral, string> = {
  amarilla: "bg-[#ffeb3b]",
  naranja: "bg-[#fca326]",
  roja: "bg-[#ee3d43]",
};
const COTA_LABEL: Record<string, string> = {
  oficial: "Oficial (DZ)",
  "inventario-altitud": "Inventario (altitud)",
  dem: "DEM",
};

const input =
  "rounded border border-slate-300 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400";

const signo = (tipo: TipoAviso) => (tipo === "vaciante" ? "≤" : "≥");
const unidad = (v: Variable) => (v === "caudal" ? "m³/s" : UNIDAD_POR_VARIABLE[v]);

// Orden válido entre los niveles activos: avenida ascendente, vaciante descendente.
function ordenValido(set: UmbralesActivos[TipoAviso], tipo: TipoAviso): boolean {
  const vals = NIVELES.map((n) => set[n]?.valor).filter((v): v is number => v != null);
  return vals.every((v, i) => i === 0 || (tipo === "vaciante" ? vals[i - 1] >= v : vals[i - 1] <= v));
}

type EstadoPeriodo = "activo" | "programado" | "vencido";
function estadoPeriodo(u: Umbral, fecha: string): EstadoPeriodo {
  if (periodoCubre(u.periodo, fecha)) return "activo";
  return u.periodo.inicio > fecha.slice(0, 10) ? "programado" : "vencido";
}
// Banderas de la plantilla SENAMHI: Conforme (verde), callout (azul), No Dato (gris).
const ESTADO_CLS: Record<EstadoPeriodo, string> = {
  activo: "border border-[#86efac] bg-[#f0fdf4] text-[#166534]",
  programado: "border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]",
  vencido: "border border-[#cbd5e1] bg-[#f8fafc] text-[#475569]",
};

// Errores de la tabla de umbrales de una estación (bloquean el guardado).
function erroresDe(rows: Umbral[]): Map<number, string> {
  const err = new Map<number, string>();
  rows.forEach((u, i) => {
    if (!Number.isFinite(u.valor)) err.set(i, "Falta el valor del umbral");
    else if (!Number.isFinite(u.vigenciaHrs) || u.vigenciaHrs <= 0) err.set(i, "La vigencia debe ser mayor a 0 h");
    else if (!u.periodo.inicio) err.set(i, "Falta la fecha de inicio");
    else if (u.periodo.fin && u.periodo.fin < u.periodo.inicio) err.set(i, "El fin es anterior al inicio");
    else if (rows.some((o, j) => j !== i && haySolape(u, o)))
      err.set(i, "Se solapa con otro periodo del mismo umbral");
  });
  return err;
}

function Tarjeta({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">{titulo}</h3>
        {ayuda && <p className="text-[11px] leading-snug text-slate-500">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{etiqueta}</span>
      {children}
    </div>
  );
}

function Opciones<T extends string>({
  value, options, onChange, editing,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  editing: boolean;
}) {
  if (!editing) {
    return <span className="text-sm font-semibold text-slate-800">{options.find((o) => o.value === value)?.label}</span>;
  }
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs ${value === o.value ? "bg-primary-500 font-semibold text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminConfigPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [umbrales, setUmbrales] = useState<Umbral[]>([]);
  const [fecha, setFecha] = useState("");
  const [filtroDZ, setFiltroDZ] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Borrador en edición (ficha + umbrales de la estación seleccionada).
  const [draft, setDraft] = useState<{ station: Station; umbrales: Umbral[] } | null>(null);
  // Estación cuyo modal de centros poblados está abierto.
  const [cpId, setCpId] = useState<string | null>(null);

  const recargar = () => {
    setStations(getStationsConfig());
    setUmbrales(getUmbrales());
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage (sistema externo)
    recargar();
    setFecha(getMockNow().slice(0, 10));
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  const dzList = useMemo(
    () => [...new Set(stations.map((s) => s.dz).filter(Boolean))] as string[],
    [stations]
  );

  const filtered = stations.filter((s) => {
    if (filtroDZ && s.dz !== filtroDZ) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.estacion.toLowerCase().includes(q) && !(s.rio ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const umbralesDe = (id: string) => umbrales.filter((u) => u.stationId === id);

  const abrir = (s: Station) => {
    setSelectedId(s.id);
    setDraft(null);
  };
  const cerrar = () => {
    if (draft && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    setSelectedId(null);
    setDraft(null);
  };

  // Modal abierto: bloquea el scroll de la página y cierra con Esc.
  useEffect(() => {
    if (!selectedId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  });

  const selected = stations.find((s) => s.id === selectedId) ?? null;
  const editing = draft !== null;
  const st = draft?.station ?? selected;
  const rows = draft?.umbrales ?? (selected ? umbralesDe(selected.id) : []);
  const errores = erroresDe(rows);

  const updStation = (patch: Partial<Station>) =>
    setDraft((d) => (d ? { ...d, station: { ...d.station, ...patch } } : d));
  const updUmbral = (i: number, patch: Partial<Umbral>) =>
    setDraft((d) => (d ? { ...d, umbrales: d.umbrales.map((u, j) => (j === i ? { ...u, ...patch } : u)) } : d));
  const quitarUmbral = (i: number) =>
    setDraft((d) => (d ? { ...d, umbrales: d.umbrales.filter((_, j) => j !== i) } : d));
  // Agrega un periodo a la casilla (variable, tipo, nivel). Inicia el día
  // siguiente al último fin de la casilla, o en la fecha de referencia si no
  // hay periodos o alguno es abierto (la validación marca el solape).
  const agregarPeriodo = (variable: Variable, tipo: TipoAviso, nivel: NivelUmbral) =>
    setDraft((d) => {
      if (!d) return d;
      const previos = d.umbrales.filter((u) => u.variable === variable && u.tipo === tipo && u.nivel === nivel);
      const ultimo = previos.reduce<Umbral | null>(
        (acc, u) => (!acc || u.periodo.inicio > acc.periodo.inicio ? u : acc),
        null
      );
      let inicio = fecha;
      if (previos.length > 0 && previos.every((u) => u.periodo.fin)) {
        const maxFin = previos.map((u) => u.periodo.fin!).sort().at(-1)!;
        inicio = diaSiguiente(maxFin);
      }
      return {
        ...d,
        umbrales: [
          ...d.umbrales,
          {
            stationId: d.station.id,
            variable,
            tipo,
            nivel,
            valor: ultimo?.valor ?? NaN,
            vigenciaHrs: ultimo?.vigenciaHrs ?? 200,
            periodo: { inicio, fin: null },
          },
        ],
      };
    });

  const guardar = () => {
    if (!draft || errores.size > 0) return;
    const s = draft.station;
    setStationConfig(s.id, {
      preferencia: s.preferencia,
      modoPublicacion: s.modoPublicacion,
      estado: s.estado,
      cota: s.cota,
      cotaFuente: s.cotaFuente,
    });
    setUmbralesEstacion(s.id, draft.umbrales);
    recargar();
    setDraft(null);
    flash(`Configuración guardada: ${s.estacion}`);
  };

  const restablecerUmbrales = () => {
    if (!selected) return;
    resetUmbralesEstacion(selected.id);
    recargar();
    setDraft(null);
    flash(`Umbrales restablecidos: ${selected.estacion}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Configuración de Estaciones</h1>
        <p className="text-sm text-slate-500">
          ⚙️ Configurar: umbrales, detección, publicación y datos de la estación. 📍 Centros poblados afectados por la estación (definen su cobertura). Los cambios se guardan como override local.
        </p>
      </div>

      {msg && <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</div>}

      {/* Lista de estaciones */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="flex flex-wrap items-center gap-3 rounded-t-lg bg-primary-500 px-4 py-2">
          <h2 className="text-sm font-bold uppercase text-white">Estaciones</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={filtroDZ}
              onChange={(e) => setFiltroDZ(e.target.value)}
              className="rounded border border-white/30 bg-white px-2 py-1 text-xs"
            >
              <option value="">Todas las DZ</option>
              {dzList.map((dz) => <option key={dz} value={dz}>{dz}</option>)}
            </select>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar río o estación…"
              className="w-56 rounded border border-white/30 px-2 py-1 text-xs"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-2">Estación</th>
                <th className="p-2">Río</th>
                <th className="p-2">DZ</th>
                <th className="p-2">Detecta con</th>
                <th className="p-2" title={`Umbrales activos al ${fecha} para la variable preferida`}>Umbrales activos</th>
                <th className="p-2" title="Departamentos calculados de los centros poblados">Cobertura</th>
                <th className="p-2">Publicación</th>
                <th className="p-2">Estado</th>
                <th className="p-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const pref = s.preferencia ?? "caudal";
                const activos = activosEn(umbralesDe(s.id).filter((u) => u.variable === pref), fecha);
                const sinUmbral = TIPOS.every((t) => Object.keys(activos[t]).length === 0);
                const configurados = new Set(umbralesDe(s.id).map((u) => `${u.variable}|${u.tipo}|${u.nivel}`)).size;
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-50 ${selectedId === s.id || cpId === s.id ? "bg-blue-50/60" : ""}`}
                  >
                    <td className="p-2">
                      <div className="font-semibold text-slate-800">{s.estacion}</div>
                      <div className="text-[11px] text-slate-400">{s.codigoAuto ?? "—"}</div>
                    </td>
                    <td className="p-2 text-xs text-slate-600">{s.rio}</td>
                    <td className="p-2 text-xs text-slate-600">{s.dz ?? "—"}</td>
                    <td className="p-2 text-xs font-semibold">{VAR_LABEL[pref]}</td>
                    <td className="p-2 text-xs">
                      {sinUmbral ? (
                        <span className="font-semibold text-amber-600" title="La variable preferida no tiene umbrales activos: no generará avisos">
                          ⚠ Sin umbrales activos
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          {TIPOS.map((t) => {
                            const n = Object.keys(activos[t]).length;
                            return (
                              <span key={t} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${n ? TIPO_CLS[t] : "bg-slate-50 text-slate-300"}`}>
                                {TIPO_LABEL[t]} {n}/3
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-0.5 text-[10px] text-slate-400">{configurados}/12 configurados</div>
                    </td>
                    <td className="p-2 text-xs text-slate-600" title={`Provincias: ${s.provincia.join(", ") || "—"} · Distritos: ${s.distritos.join(", ") || "—"}`}>
                      {s.departamento.join(", ") || "—"}
                    </td>
                    <td className="p-2 text-xs">
                      <span className={s.modoPublicacion === "manual" ? "text-slate-500" : "text-green-700"}>
                        {s.modoPublicacion === "manual" ? "Manual" : "Automática"}
                      </span>
                    </td>
                    <td className="p-2 text-xs">
                      {s.estado === "mantenimiento" ? (
                        <span className="text-slate-400">Mantenimiento</span>
                      ) : (
                        <span className="text-slate-600">Activa</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-2 text-center">
                      <button
                        onClick={() => abrir(s)}
                        className="rounded bg-primary-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-600"
                        title="Configurar umbrales, detección, publicación y estación"
                      >
                        ⚙️ Configurar
                      </button>
                      <button
                        onClick={() => setCpId(s.id)}
                        className={`ml-1.5 rounded px-2.5 py-1 text-xs font-semibold ${
                          (s.pobladosGeo ?? []).length === 0
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                        title={(s.pobladosGeo ?? []).length === 0 ? "Sin centros poblados: el aviso no indicará poblaciones afectadas" : "Centros poblados afectados"}
                      >
                        📍 {(s.pobladosGeo ?? []).length}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-4 text-center text-slate-400">Sin estaciones para el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de centros poblados afectados */}
      {cpId && stations.find((s) => s.id === cpId) && (
        <ModalCentrosPoblados
          station={stations.find((s) => s.id === cpId)!}
          stations={stations}
          onClose={() => setCpId(null)}
          onSaved={(m) => {
            recargar();
            setCpId(null);
            flash(m);
          }}
        />
      )}

      {/* Modal centrado: edición de la estación */}
      {st && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 backdrop-blur-[2px] sm:p-6"
          onClick={cerrar}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-estacion-titulo"
            className="flex h-full w-full max-w-6xl animate-modal-in flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera fija */}
            <header className="flex flex-none items-center gap-3 bg-primary-500 px-5 py-3">
              <div className="min-w-0">
                <h2 id="modal-estacion-titulo" className="truncate text-sm font-bold uppercase text-white">{st.estacion}</h2>
                <p className="text-xs text-white/70">Río {st.rio} · {st.dz ?? "—"} · {st.codigoAuto ?? "—"}</p>
              </div>
              {editing && (
                <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">Editando</span>
              )}
              <button
                onClick={cerrar}
                className="ml-auto rounded p-1 text-xl leading-none text-white/70 hover:bg-white/10 hover:text-white"
                title="Cerrar (Esc)"
              >
                ✕
              </button>
            </header>

            {/* Cuerpo con scroll */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Tarjeta titulo="Detección" ayuda="Variable con la que la estación genera avisos. Avenida y vaciante se evalúan a la vez.">
                  <Opciones
                    editing={editing}
                    value={st.preferencia ?? "caudal"}
                    options={VARIABLES.map((v) => ({ value: v, label: VAR_LABEL[v] }))}
                    onChange={(v) => updStation({ preferencia: v })}
                  />
                </Tarjeta>

                <Tarjeta titulo="Publicación" ayuda="Automática: el aviso detectado se publica solo. Manual: queda para revisión en Avisos.">
                  <Opciones
                    editing={editing}
                    value={st.modoPublicacion ?? "automatico"}
                    options={[{ value: "automatico", label: "Automática" }, { value: "manual", label: "Manual" }]}
                    onChange={(v) => updStation({ modoPublicacion: v })}
                  />
                </Tarjeta>

                <Tarjeta titulo="Estación" ayuda="La cota solo se usa para mostrar el nivel en m.s.n.m.; no afecta la detección.">
                  <div className="space-y-1.5">
                    <Campo etiqueta="Estado">
                      <Opciones
                        editing={editing}
                        value={st.estado ?? "activa"}
                        options={[{ value: "activa", label: "Activa" }, { value: "mantenimiento", label: "Mantenimiento" }]}
                        onChange={(v) => updStation({ estado: v })}
                      />
                    </Campo>
                    <Campo etiqueta="Cota (m.s.n.m.)">
                      {editing ? (
                        <input
                          type="number" step="any" className={`${input} w-28`} value={st.cota ?? ""}
                          onChange={(e) => updStation({ cota: e.target.value === "" ? null : parseFloat(e.target.value) })}
                        />
                      ) : (
                        <span className="text-sm font-semibold text-slate-800">{st.cota ?? "—"}</span>
                      )}
                    </Campo>
                    <Campo etiqueta="Fuente de la cota">
                      {editing ? (
                        <select
                          className={input} value={st.cotaFuente ?? "inventario-altitud"}
                          onChange={(e) => updStation({ cotaFuente: e.target.value as Station["cotaFuente"] })}
                        >
                          {Object.entries(COTA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <span className="text-sm font-semibold text-slate-800">{COTA_LABEL[st.cotaFuente ?? "inventario-altitud"]}</span>
                      )}
                    </Campo>
                  </div>
                </Tarjeta>
              </div>

              <section className="space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Umbrales y vigencia</h3>
                    <p className="text-[11px] text-slate-500">
                      Las 12 combinaciones (variable × tipo × nivel): valor, vigencia (h) del aviso que genera y periodo en que está activo. Estado al {fecha}.
                    </p>
                  </div>
                  {editing && (
                    <button onClick={restablecerUmbrales} className="ml-auto text-xs text-red-500 hover:underline">
                      Restablecer umbrales al valor base
                    </button>
                  )}
                </div>
                <TablaUmbrales
                  rows={rows}
                  fecha={fecha}
                  preferencia={st.preferencia ?? "caudal"}
                  editing={editing}
                  errores={errores}
                  onUpd={updUmbral}
                  onQuitar={quitarUmbral}
                  onAgregar={agregarPeriodo}
                />
              </section>
            </div>

            {/* Pie fijo con acciones */}
            <footer className="flex flex-none items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              {editing && errores.size > 0 ? (
                <span className="text-xs font-semibold text-red-600">
                  ⚠ {errores.size} error{errores.size > 1 ? "es" : ""} en umbrales: corrígelos para guardar
                </span>
              ) : (
                <span className="text-xs text-slate-400">Esc para cerrar</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={() => setDraft(null)} className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
                      Cancelar
                    </button>
                    <button
                      onClick={guardar}
                      disabled={errores.size > 0}
                      className={`rounded px-4 py-1.5 text-xs font-semibold ${errores.size > 0 ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-primary-500 text-white hover:bg-primary-600"}`}
                    >
                      Guardar
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={cerrar} className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
                      Cerrar
                    </button>
                    <button
                      onClick={() => selected && setDraft({ station: { ...selected }, umbrales: umbralesDe(selected.id).map((u) => ({ ...u, periodo: { ...u.periodo } })) })}
                      className="rounded bg-primary-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
                    >
                      ✏️ Editar
                    </button>
                  </>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

// Día siguiente a una fecha YYYY-MM-DD (en hora local).
function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Periodos de una casilla: primero el principal (activo; si no, el próximo
// programado; si no, el último vencido) y luego el resto por fecha de inicio.
function periodosDeCasilla(
  rows: Umbral[], variable: Variable, tipo: TipoAviso, nivel: NivelUmbral, fecha: string
): { u: Umbral; i: number }[] {
  const lista = rows
    .map((u, i) => ({ u, i }))
    .filter(({ u }) => u.variable === variable && u.tipo === tipo && u.nivel === nivel)
    .sort((a, b) => a.u.periodo.inicio.localeCompare(b.u.periodo.inicio));
  const principal =
    lista.find(({ u }) => estadoPeriodo(u, fecha) === "activo") ??
    lista.find(({ u }) => estadoPeriodo(u, fecha) === "programado") ??
    lista.at(-1);
  return principal ? [principal, ...lista.filter((p) => p !== principal)] : [];
}

// Tabla con las 12 casillas fijas (variable × tipo × nivel), siempre visibles.
function TablaUmbrales({
  rows, fecha, preferencia, editing, errores, onUpd, onQuitar, onAgregar,
}: {
  rows: Umbral[];
  fecha: string;
  preferencia: Variable;
  editing: boolean;
  errores: Map<number, string>;
  onUpd: (i: number, patch: Partial<Umbral>) => void;
  onQuitar: (i: number) => void;
  onAgregar: (variable: Variable, tipo: TipoAviso, nivel: NivelUmbral) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="p-2">Tipo</th>
            <th className="p-2">Nivel</th>
            <th className="p-2">Umbral</th>
            <th className="p-2">Vigencia</th>
            <th className="p-2">Inicio</th>
            <th className="p-2">Fin</th>
            <th className="p-2">Estado</th>
            <th className="p-2" />
          </tr>
        </thead>
        {VARIABLES.map((v) => {
          const generaAvisos = v === preferencia;
          const activos = activosEn(rows.filter((u) => u.variable === v), fecha);
          const atenuado = generaAvisos ? "" : "opacity-70";
          return (
            <tbody key={v} className="divide-y divide-slate-100 border-t border-slate-200">
              <tr>
                <td
                  colSpan={8}
                  className={`px-2 py-1.5 font-bold ${generaAvisos ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {VAR_LABEL[v].toUpperCase()} ({unidad(v)})
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-normal ${generaAvisos ? "bg-white/20" : "bg-white text-slate-400"}`}>
                    {generaAvisos ? "genera avisos" : `no genera avisos (preferencia: ${VAR_LABEL[preferencia].toLowerCase()})`}
                  </span>
                </td>
              </tr>
              {TIPOS.flatMap((t) => {
                const porNivel = NIVELES.map((n) => ({ n, periodos: periodosDeCasilla(rows, v, t, n, fecha) }));
                const filasTipo = porNivel.reduce((acc, { periodos }) => acc + Math.max(1, periodos.length), 0);
                const ok = ordenValido(activos[t], t);
                return porNivel.flatMap(({ n, periodos }, ni) => {
                  const celdaTipo = ni === 0 && (
                    <td rowSpan={filasTipo} className={`border-r border-slate-100 p-2 align-top font-semibold ${TIPO_CLS[t]}`}>
                      {TIPO_LABEL[t]}
                      {!ok && <span className="ml-1 text-red-600" title="Umbrales activos fuera de orden">⚠</span>}
                    </td>
                  );
                  const celdaNivel = (
                    <td rowSpan={Math.max(1, periodos.length)} className="whitespace-nowrap p-2 align-top">
                      <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${NIVEL_DOT[n]}`} />
                      {NIVEL_LABEL[n]}
                    </td>
                  );
                  if (periodos.length === 0) {
                    return [
                      <tr key={`${t}-${n}`} className={atenuado}>
                        {celdaTipo}
                        {celdaNivel}
                        <td colSpan={5} className="p-2 text-slate-300">— Sin umbral</td>
                        <td className="p-2 text-right">
                          {editing && (
                            <button onClick={() => onAgregar(v, t, n)} className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-primary-500 hover:bg-slate-200">
                              Configurar
                            </button>
                          )}
                        </td>
                      </tr>,
                    ];
                  }
                  return periodos.map(({ u, i }, pi) => {
                    const estado = estadoPeriodo(u, fecha);
                    const error = errores.get(i);
                    return (
                      <tr
                        key={`${t}-${n}-${i}`}
                        title={error}
                        className={`${atenuado} ${error ? "bg-red-50" : estado === "vencido" ? "text-slate-400" : ""}`}
                      >
                        {pi === 0 && celdaTipo}
                        {pi === 0 && celdaNivel}
                        <td className="whitespace-nowrap p-2">
                          {pi > 0 && <span className="mr-1 text-slate-300">↳</span>}
                          {signo(t)}{" "}
                          {editing ? (
                            <input
                              type="number" step="any" className={`${input} w-20`}
                              value={Number.isFinite(u.valor) ? u.valor : ""}
                              onChange={(e) => onUpd(i, { valor: e.target.value === "" ? NaN : parseFloat(e.target.value) })}
                            />
                          ) : (
                            <span className="font-semibold">{u.valor}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap p-2">
                          {editing ? (
                            <input
                              type="number" step="1" min="1" className={`${input} w-16`}
                              value={Number.isFinite(u.vigenciaHrs) ? u.vigenciaHrs : ""}
                              onChange={(e) => onUpd(i, { vigenciaHrs: e.target.value === "" ? NaN : parseFloat(e.target.value) })}
                            />
                          ) : (
                            u.vigenciaHrs
                          )}{" "}h
                        </td>
                        <td className="p-2">
                          {editing ? (
                            <input type="date" className={input} value={u.periodo.inicio}
                              onChange={(e) => onUpd(i, { periodo: { ...u.periodo, inicio: e.target.value } })} />
                          ) : u.periodo.inicio}
                        </td>
                        <td className="p-2">
                          {editing ? (
                            <input type="date" className={input} value={u.periodo.fin ?? ""}
                              onChange={(e) => onUpd(i, { periodo: { ...u.periodo, fin: e.target.value || null } })} />
                          ) : (u.periodo.fin ?? "Sin fin")}
                        </td>
                        <td className="p-2">
                          {error ? (
                            <span className="font-semibold text-red-600">⚠ {error}</span>
                          ) : (
                            <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${ESTADO_CLS[estado]}`}>{estado}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap p-2 text-right">
                          {editing && (
                            <>
                              {pi === 0 && (
                                <button onClick={() => onAgregar(v, t, n)} className="mr-2 font-bold text-primary-500 hover:text-primary-600" title="Agregar otro periodo">
                                  +
                                </button>
                              )}
                              <button onClick={() => onQuitar(i)} className="text-slate-400 hover:text-red-600" title="Quitar periodo">🗑</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  });
                });
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
