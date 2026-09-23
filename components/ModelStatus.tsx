import { getModelStatus, modelBadge } from "@/lib/ports";

export default function ModelStatus() {
  const models = getModelStatus();
  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="font-semibold mb-2">Estado de modelos (mini-DC Junín)</h2>
      <ul className="space-y-2 text-sm">
        {models.map((m) => (
          <li key={m.nombre} className="flex flex-col gap-1 border-b last:border-0 pb-2">
            <span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${modelBadge(m.status)}`}>
                {m.status}
              </span>{" "}
              <b>{m.nombre}</b>
            </span>
            <span className="text-slate-600 text-xs">{m.detalle}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
