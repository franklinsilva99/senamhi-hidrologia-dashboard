import type { Station, Thresholds } from "@/lib/types";

export default function TablaDatosAviso({
  station,
  thresholds,
  preferencia,
  nivelActual,
  caudalActual,
  cota,
  hora,
}: {
  station: Station;
  thresholds?: Thresholds;
  preferencia?: "caudal" | "nivel";
  nivelActual?: number;
  caudalActual?: number;
  cota?: number | null;
  hora?: string;
}) {
  const esNivel = (preferencia ?? thresholds?.preferencia) === "nivel";
  const tieneCota = esNivel && cota != null;
  const offset = tieneCota ? (cota as number) : 0;
  const unidad = esNivel ? "m.s.n.m." : "m³/s";

  const valorActual = esNivel ? nivelActual : caudalActual;
  const umbralRojoRel = esNivel ? thresholds?.nivel.roja : thresholds?.caudal.roja;
  const umbralRojo = umbralRojoRel != null ? umbralRojoRel + offset : undefined;

  const etiquetaActual = esNivel
    ? `Nivel${hora ? ` a las ${hora}` : " actual"} (${unidad})`
    : `Caudal actual (${unidad})`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-slate-200">
        <thead>
          <tr className="bg-[#00539b] text-white text-center">
            <th className="p-2 align-middle">Cuerpo de Agua</th>
            <th className="p-2 align-middle">Estación</th>
            <th className="p-2 align-middle">Distrito</th>
            <th className="p-2 align-middle">{etiquetaActual}</th>
            <th className="p-2 align-middle bg-[#ee3d43]">Umbral Rojo ({unidad})</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-center">
            <td className="p-2 align-middle">{station.rio.toUpperCase()}</td>
            <td className="p-2 align-middle">{station.estacion.toUpperCase()}</td>
            <td className="p-2 align-middle">{station.distritos.join(", ").toUpperCase() || "—"}</td>
            <td className="p-2 align-middle font-bold">{valorActual?.toFixed(2)}</td>
            <td className="p-2 align-middle font-bold text-[#ee3d43]">{umbralRojo?.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
