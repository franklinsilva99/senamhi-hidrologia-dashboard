"use client";
import { useEffect, useMemo, useState } from "react";
import { setStationConfig } from "@/lib/infra/stationConfig";
import { conCobertura } from "@/lib/domain/cobertura";
import type { Station } from "@/lib/domain/types";

// ── Mantenedor de centros poblados afectados de una estación ──
// Cada centro poblado lleva su ubicación (texto libre) y coordenadas; la
// cobertura de la estación (departamentos/provincias/distritos) se calcula de
// ellos. Se abre desde la tabla de configuración de estaciones.

// Poblado en edición: lat/lon como string para evitar NaN al vaciar el input.
interface PobladoEdit {
  nombre: string;
  distrito: string;
  provincia: string;
  departamento: string;
  lat: string;
  lon: string;
}

const UBICACION = ["distrito", "provincia", "departamento"] as const;
type CampoUbicacion = (typeof UBICACION)[number];
const UBICACION_LABEL: Record<CampoUbicacion, string> = {
  distrito: "Distrito",
  provincia: "Provincia",
  departamento: "Departamento",
};

const inputCls =
  "w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400";

function aEdicion(s: Station): PobladoEdit[] {
  return (s.pobladosGeo ?? []).map((p) => ({
    nombre: p.nombre,
    distrito: p.distrito ?? "",
    provincia: p.provincia ?? "",
    departamento: p.departamento ?? "",
    lat: String(p.lat),
    lon: String(p.lon),
  }));
}

function aGeo(poblados: PobladoEdit[]) {
  return poblados.map((p) => ({
    nombre: p.nombre.trim(),
    distrito: p.distrito.trim() || undefined,
    provincia: p.provincia.trim() || undefined,
    departamento: p.departamento.trim() || undefined,
    lat: parseFloat(p.lat) || 0,
    lon: parseFloat(p.lon) || 0,
  }));
}

export default function ModalCentrosPoblados({
  station,
  stations,
  onClose,
  onSaved,
}: {
  station: Station;
  // Todas las estaciones: fuente de las sugerencias de ubicación.
  stations: Station[];
  onClose: () => void;
  onSaved: (mensaje: string) => void;
}) {
  const [inicial] = useState(() => aEdicion(station));
  const [poblados, setPoblados] = useState<PobladoEdit[]>(inicial);
  const cambiado = JSON.stringify(poblados) !== JSON.stringify(inicial);

  // Sugerencias: valores ya cargados en cualquier estación (solo ayudan a
  // escribir igual, p. ej. "Azángaro"; el campo sigue siendo libre).
  const sugerencias = useMemo(() => {
    const out: Record<CampoUbicacion, Set<string>> = {
      distrito: new Set(), provincia: new Set(), departamento: new Set(),
    };
    for (const s of stations) {
      s.distritos.forEach((x) => out.distrito.add(x));
      s.provincia.forEach((x) => out.provincia.add(x));
      s.departamento.forEach((x) => out.departamento.add(x));
    }
    return Object.fromEntries(
      UBICACION.map((k) => [k, [...out[k]].sort((a, b) => a.localeCompare(b, "es"))])
    ) as Record<CampoUbicacion, string[]>;
  }, [stations]);

  // Vista previa de la cobertura con los cambios en curso.
  const cobertura = conCobertura({ ...station, pobladosGeo: aGeo(poblados) });

  const cerrar = () => {
    if (cambiado && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    onClose();
  };

  // Modal abierto: bloquea el scroll de la página y cierra con Esc.
  useEffect(() => {
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

  const update = (idx: number, patch: Partial<PobladoEdit>) =>
    setPoblados((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  // El nuevo poblado hereda provincia y departamento del último (lo más común
  // es que estén en la misma zona); se pueden cambiar.
  const agregar = () =>
    setPoblados((p) => {
      const ult = p.at(-1);
      return [...p, { nombre: "", distrito: "", provincia: ult?.provincia ?? "", departamento: ult?.departamento ?? "", lat: "", lon: "" }];
    });

  const quitar = (idx: number) => setPoblados((p) => p.filter((_, i) => i !== idx));

  const sinNombre = poblados.some((p) => !p.nombre.trim());

  const guardar = () => {
    if (sinNombre) return;
    const geo = aGeo(poblados);
    setStationConfig(station.id, { poblados: geo.map((p) => p.nombre), pobladosGeo: geo });
    onSaved(`Centros poblados guardados: ${station.estacion}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 backdrop-blur-[2px] sm:p-6"
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cp-titulo"
        className="flex h-full w-full max-w-5xl animate-modal-in flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-none items-center gap-3 bg-primary-500 px-5 py-3">
          <div className="min-w-0">
            <h2 id="modal-cp-titulo" className="truncate text-sm font-bold uppercase text-white">
              Centros poblados · {station.estacion}
            </h2>
            <p className="text-xs text-white/70">Río {station.rio} · {station.dz ?? "—"} · {station.codigoAuto ?? "—"}</p>
          </div>
          <button
            onClick={cerrar}
            className="ml-auto rounded p-1 text-xl leading-none text-white/70 hover:bg-white/10 hover:text-white"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {UBICACION.map((k) => (
            <datalist key={k} id={`sug-${k}`}>
              {sugerencias[k].map((v) => <option key={v} value={v} />)}
            </datalist>
          ))}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="p-2">Nombre</th>
                  {UBICACION.map((k) => <th key={k} className="p-2">{UBICACION_LABEL[k]}</th>)}
                  <th className="p-2">Latitud</th>
                  <th className="p-2">Longitud</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {poblados.map((p, i) => (
                  <tr key={i} className={!p.nombre.trim() ? "bg-red-50" : ""}>
                    <td className="p-2">
                      <input
                        type="text" value={p.nombre} placeholder="Nombre"
                        onChange={(e) => update(i, { nombre: e.target.value })}
                        className={inputCls}
                      />
                    </td>
                    {UBICACION.map((k) => (
                      <td key={k} className="p-2">
                        <input
                          type="text" list={`sug-${k}`} value={p[k]}
                          onChange={(e) => update(i, { [k]: e.target.value })}
                          className={inputCls}
                        />
                      </td>
                    ))}
                    <td className="p-2">
                      <input
                        type="number" step="any" value={p.lat}
                        onChange={(e) => update(i, { lat: e.target.value })}
                        className={`${inputCls} w-24`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number" step="any" value={p.lon}
                        onChange={(e) => update(i, { lon: e.target.value })}
                        className={`${inputCls} w-24`}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => quitar(i)} className="text-slate-400 hover:text-red-600" title="Quitar centro poblado">🗑</button>
                    </td>
                  </tr>
                ))}
                {poblados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400">
                      Sin centros poblados: el aviso de esta estación no indicará poblaciones afectadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button onClick={agregar} className="rounded bg-slate-100 px-3 py-1.5 text-xs font-semibold text-primary-500 hover:bg-slate-200">
            + Agregar centro poblado
          </button>

          {/* Cobertura calculada (vista previa) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs">
            <h3 className="mb-1.5 font-bold uppercase tracking-wide text-slate-700">Cobertura de la estación (calculada)</h3>
            <dl className="grid gap-1 sm:grid-cols-3">
              <div><dt className="text-slate-500">Departamentos</dt><dd className="font-semibold text-slate-800">{cobertura.departamento.join(", ") || "—"}</dd></div>
              <div><dt className="text-slate-500">Provincias</dt><dd className="font-semibold text-slate-800">{cobertura.provincia.join(", ") || "—"}</dd></div>
              <div><dt className="text-slate-500">Distritos</dt><dd className="font-semibold text-slate-800">{cobertura.distritos.join(", ") || "—"}</dd></div>
            </dl>
          </div>
        </div>

        <footer className="flex flex-none items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          {sinNombre ? (
            <span className="text-xs font-semibold text-red-600">⚠ Hay centros poblados sin nombre</span>
          ) : (
            <span className="text-xs text-slate-400">{poblados.length} centro(s) poblado(s) · Esc para cerrar</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={cerrar} className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={sinNombre || !cambiado}
              className={`rounded px-4 py-1.5 text-xs font-semibold ${sinNombre || !cambiado ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-primary-500 text-white hover:bg-primary-600"}`}
            >
              Guardar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
