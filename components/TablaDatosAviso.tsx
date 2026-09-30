import type { Station } from "@/lib/domain/types";

export default function TablaDatosAviso({
  station,
  preferencia,
  nivelActual,
  caudalActual,
  cota,
  hora,
  umbralRojoRel,
}: {
  station: Station;
  preferencia?: "caudal" | "nivel";
  nivelActual?: number;
  caudalActual?: number;
  cota?: number | null;
  hora?: string;
  umbralRojoRel?: number;
}) {
  const esNivel = preferencia === "nivel";
  const offset = esNivel && cota != null ? (cota as number) : 0;
  const unidad = esNivel ? "m.s.n.m." : "m³/s";

  const valorActual = esNivel ? nivelActual : caudalActual;
  const umbralRojo = umbralRojoRel != null ? umbralRojoRel + offset : undefined;

  const etiquetaActual = esNivel
    ? `Nivel${hora ? ` a las ${hora}` : " actual"} (${unidad})`
    : `Caudal actual (${unidad})`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-xs sm:text-sm border-collapse">
        <thead>
          <tr className="bg-[#0070c0] text-white divide-x divide-blue-400 font-bold">
            <th className="py-2.5 px-3 uppercase tracking-tight">Cuerpo de Agua</th>
            <th className="py-2.5 px-3 uppercase tracking-tight">Estación</th>
            <th className="py-2.5 px-3 uppercase tracking-tight">Distrito</th>
            <th className="py-2.5 px-3 uppercase tracking-tight">{etiquetaActual}</th>
            <th className="py-2.5 px-3 uppercase tracking-tight">Umbral Rojo ({unidad})</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 text-gray-800 bg-white">
          <tr className="divide-x divide-gray-200 text-xs sm:text-[13px]">
            <td className="py-2 px-3 font-medium">{station.rio.toUpperCase()}</td>
            <td className="py-2 px-3">{station.estacion.toUpperCase()}</td>
            <td className="py-2 px-3">{station.distritos.join(", ").toUpperCase() || "—"}</td>
            <td className="py-2 px-3 font-semibold">{valorActual?.toFixed(2)}</td>
            <td className="py-2 px-3 font-semibold">{umbralRojo?.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
