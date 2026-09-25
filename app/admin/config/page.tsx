"use client";
import { useEffect, useState } from "react";
import {
  getConfigMap,
  setConfigEstacion,
  resetConfigEstacion,
  type ConfigEstacion,
} from "@/lib/configEstacion";
import type { TipoAviso } from "@/lib/types";

const MODO_KEY = "senamhi_modo_publicacion";
type Modo = "automatico" | "manual";

function Texto({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: unknown) => void;
  type?: "text" | "number";
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(type === "number" ? (e.target.value === "" ? null : parseFloat(e.target.value)) : e.target.value)
        }
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
      />
    </label>
  );
}

function Lista({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type="text"
        value={(value ?? []).join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
      />
    </label>
  );
}

function Sel<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdminConfigPage() {
  const [draft, setDraft] = useState<Record<string, ConfigEstacion>>({});
  const [msg, setMsg] = useState("");
  const [modo, setModo] = useState<Modo>("automatico");

  useEffect(() => {
    setDraft(getConfigMap());
    const m = localStorage.getItem(MODO_KEY);
    if (m === "manual" || m === "automatico") setModo(m);
  }, []);

  const upd = (id: string, patch: Partial<ConfigEstacion>) =>
    setDraft((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const guardar = (id: string) => {
    const c = draft[id];
    setConfigEstacion(id, {
      rio: c.rio,
      cuenca: c.cuenca,
      dz: c.dz,
      region: c.region,
      departamento: c.departamento,
      provincia: c.provincia,
      distritos: c.distritos,
      poblados: c.poblados,
      cota: c.cota,
      variables: c.variables,
      estado: c.estado,
      tipo: c.tipo,
      preferencia: c.preferencia,
      caudal: c.caudal,
      nivel: c.nivel,
      qc1: c.qc1,
      duracionHoras: c.duracionHoras,
    });
    setMsg(`Guardado: ${c.estacion}`);
    setTimeout(() => setMsg(""), 3000);
  };

  const restablecer = (id: string) => {
    resetConfigEstacion(id);
    setDraft(getConfigMap());
    setMsg(`Restablecido: ${draft[id]?.estacion ?? id}`);
    setTimeout(() => setMsg(""), 3000);
  };

  const cambiarModo = (m: Modo) => {
    setModo(m);
    localStorage.setItem(MODO_KEY, m);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Configuración de Estaciones</h1>
        <p className="text-sm text-slate-500">
          Ficha/ubicación (catálogo) y alertas/medición (umbrales, QC1, duración) por estación. Los cambios se guardan como
          override local.
        </p>
      </div>

      {msg && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</div>
      )}

      {/* Global */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-bold uppercase text-slate-700">Global</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Sel<Modo>
            label="Modo de publicación"
            value={modo}
            onChange={cambiarModo}
            options={[
              { value: "automatico", label: "Automática" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </div>
      </div>

      {Object.values(draft).map((c) => (
        <div key={c.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-800">
              {c.estacion} <span className="text-xs font-normal text-slate-500">({c.rio})</span>
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => guardar(c.id)}
                className="rounded bg-[#00539b] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0070ba]"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => restablecer(c.id)}
                className="rounded bg-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-300"
              >
                Restablecer
              </button>
            </div>
          </div>

          {/* Ficha / ubicación */}
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#00539b]">Ficha / Ubicación</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Texto label="Río" value={c.rio} onChange={(v) => upd(c.id, { rio: String(v) })} />
              <Texto label="Cuenca" value={c.cuenca} onChange={(v) => upd(c.id, { cuenca: String(v) })} />
              <Texto label="DZ" value={c.dz ?? ""} onChange={(v) => upd(c.id, { dz: String(v) })} />
              <Sel
                label="Región"
                value={c.region}
                onChange={(v) => upd(c.id, { region: v })}
                options={[
                  { value: "Pacifico", label: "Pacífico" },
                  { value: "Titicaca", label: "Titicaca" },
                  { value: "Amazonas", label: "Amazonas" },
                ]}
              />
              <Texto label="Departamento" value={c.departamento} onChange={(v) => upd(c.id, { departamento: String(v) })} />
              <Lista label="Provincia" value={c.provincia} onChange={(v) => upd(c.id, { provincia: v })} />
              <Lista label="Distritos" value={c.distritos} onChange={(v) => upd(c.id, { distritos: v })} />
              <Lista label="Poblados" value={c.poblados} onChange={(v) => upd(c.id, { poblados: v })} />
              <Texto label="Cota (m.s.n.m.)" type="number" step="any" value={c.cota} onChange={(v) => upd(c.id, { cota: v as number | null })} />
              <Sel
                label="Estado"
                value={c.estado ?? "activa"}
                onChange={(v) => upd(c.id, { estado: v })}
                options={[
                  { value: "activa", label: "Activa" },
                  { value: "mantenimiento", label: "En mantenimiento" },
                ]}
              />
              <div className="col-span-2">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-500">Variables disponibles</span>
                <div className="flex items-center gap-4 pt-1 text-xs text-slate-700">
                  {(["caudal", "nivel"] as const).map((v) => {
                    const vars = c.variables ?? ["caudal", "nivel"];
                    const checked = vars.includes(v);
                    return (
                      <label key={v} className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...new Set([...vars, v])] : vars.filter((x) => x !== v);
                            upd(c.id, { variables: next });
                          }}
                        />
                        {v === "caudal" ? "Caudal" : "Nivel"}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Alertas / medición */}
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#00539b]">Alertas / Medición</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Sel<TipoAviso>
                label="Tipo"
                value={c.tipo}
                onChange={(v) => upd(c.id, { tipo: v })}
                options={[
                  { value: "avenida", label: "Avenida" },
                  { value: "vigilancia", label: "Vigilancia" },
                ]}
              />
              <Sel<"caudal" | "nivel">
                label="Preferencia"
                value={c.preferencia}
                onChange={(v) => upd(c.id, { preferencia: v })}
                options={[
                  { value: "caudal", label: "Caudal" },
                  { value: "nivel", label: "Nivel" },
                ]}
              />
              <div className="col-span-2 md:col-span-2" />
              <Texto label="Caudal amarilla (m³/s)" type="number" step="any" value={c.caudal.amarilla} onChange={(v) => upd(c.id, { caudal: { ...c.caudal, amarilla: Number(v) } })} />
              <Texto label="Caudal naranja (m³/s)" type="number" step="any" value={c.caudal.naranja} onChange={(v) => upd(c.id, { caudal: { ...c.caudal, naranja: Number(v) } })} />
              <Texto label="Caudal roja (m³/s)" type="number" step="any" value={c.caudal.roja} onChange={(v) => upd(c.id, { caudal: { ...c.caudal, roja: Number(v) } })} />
              <div />
              <Texto label="Nivel amarilla (m)" type="number" step="any" value={c.nivel.amarilla} onChange={(v) => upd(c.id, { nivel: { ...c.nivel, amarilla: Number(v) } })} />
              <Texto label="Nivel naranja (m)" type="number" step="any" value={c.nivel.naranja} onChange={(v) => upd(c.id, { nivel: { ...c.nivel, naranja: Number(v) } })} />
              <Texto label="Nivel roja (m)" type="number" step="any" value={c.nivel.roja} onChange={(v) => upd(c.id, { nivel: { ...c.nivel, roja: Number(v) } })} />
              <div />
              <Texto label="QC1 mín" type="number" step="any" value={c.qc1.min} onChange={(v) => upd(c.id, { qc1: { ...c.qc1, min: Number(v) } })} />
              <Texto label="QC1 máx" type="number" step="any" value={c.qc1.max} onChange={(v) => upd(c.id, { qc1: { ...c.qc1, max: Number(v) } })} />
              <Texto label="QC1 Δmáx" type="number" step="any" value={c.qc1.deltaMax} onChange={(v) => upd(c.id, { qc1: { ...c.qc1, deltaMax: Number(v) } })} />
              <div />
              <Texto label="Vigencia amarilla (h)" type="number" step="1" value={c.duracionHoras.amarilla} onChange={(v) => upd(c.id, { duracionHoras: { ...c.duracionHoras, amarilla: Number(v) } })} />
              <Texto label="Vigencia naranja (h)" type="number" step="1" value={c.duracionHoras.naranja} onChange={(v) => upd(c.id, { duracionHoras: { ...c.duracionHoras, naranja: Number(v) } })} />
              <Texto label="Vigencia roja (h)" type="number" step="1" value={c.duracionHoras.roja} onChange={(v) => upd(c.id, { duracionHoras: { ...c.duracionHoras, roja: Number(v) } })} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
