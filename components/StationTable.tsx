import type { Observation, Station } from "@/lib/types";

const badge: Record<string, string> = {
  normal: "bg-green-100 text-green-800",
  amarilla: "bg-[#ffeb3b] text-black",
  naranja: "bg-[#fca326] text-white",
  roja: "bg-[#ee3d43] text-white",
};

export default function StationTable({
  stations,
  latest,
}: {
  stations: Station[];
  latest: Record<string, Observation>;
}) {
  return (
    <div className="bg-white rounded-xl border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="p-2">Río / Estación</th>
            <th className="p-2">Cuenca / DZ</th>
            <th className="p-2">Caudal</th>
            <th className="p-2">Nivel</th>
            <th className="p-2">Poblados</th>
            <th className="p-2">Estado</th>
            <th className="p-2">QC1</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s: Station) => {
            const o = latest[s.id];
            return (
              <tr key={s.id} className="border-t">
                <td className="p-2"><b>{s.estacion}</b><br /><span className="text-xs">{s.rio}</span></td>
                <td className="p-2 text-xs">{s.cuenca}<br />{s.dz ?? "—"}</td>
                <td className="p-2">{o?.caudal} m³/s</td>
                <td className="p-2">{o?.nivel} m</td>
                <td className="p-2 text-xs">{s.poblados.join(", ")}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge[o?.estado ?? "normal"]}`}>
                    {o?.estado}
                  </span>
                </td>
                <td className="p-2 text-xs">{o?.origen}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
