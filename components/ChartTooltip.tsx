"use client";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const C_LINEA = "#0000ff";
const C_ROJO = "#ee3d43";
const C_NARANJA = "#fca326";
const C_AMARILLO = "#ffeb3b";

function formatFechaHora(fecha: string): string {
  const d = new Date(fecha.replace(" ", "T"));
  if (isNaN(d.getTime())) return fecha;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

function num(v: number): string {
  return String(Number(Number(v).toFixed(2)));
}

type Props = {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: number | string | null }>;
  label?: string | number;
  varName: string;
  unidad: string;
  a: number;
  n: number;
  r: number;
};

export default function ChartTooltip({ active, payload, label, varName, unidad, a, n, r }: Props) {
  if (!active || !payload || payload.length === 0) return null;

  const punto = payload.find((p) => p.dataKey === "valor");
  const valor = punto?.value;

  return (
    <div className="bg-white/95 border border-slate-300 rounded shadow-sm px-3 py-2 text-xs text-slate-700">
      <p className="font-semibold mb-1">{formatFechaHora(String(label))}</p>
      <p className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: C_LINEA }} />
        {varName} ({unidad}): <strong>{valor != null ? num(Number(valor)) : "—"}</strong>
      </p>
      <p className="flex items-center gap-1.5 mt-0.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: C_ROJO }} />
        Umbral Rojo: {num(r)}
      </p>
      <p className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: C_NARANJA }} />
        Umbral Naranja: {num(n)}
      </p>
      <p className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: C_AMARILLO }} />
        Umbral Amarillo: {num(a)}
      </p>
    </div>
  );
}
