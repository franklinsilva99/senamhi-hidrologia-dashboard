import type { TipoAviso } from "@/lib/types";
import { PELIGRO } from "@/lib/nivelesPeligro";

export default function LeyendaNiveles({ tipo = "avenida" }: { tipo?: TipoAviso }) {
  const textos = PELIGRO[tipo];

  return (
    <div className="space-y-0 border border-slate-300 rounded overflow-hidden">
      {/* ROJO */}
      <div className="flex items-stretch border-b border-slate-300">
        <div className="flex items-center justify-center w-28 bg-[#ff0000] flex-shrink-0">
          <span className="text-white font-bold text-sm">ROJO</span>
        </div>
        <div className="flex-1 p-3 text-sm text-justify text-slate-700">
          {textos.ROJO}
        </div>
      </div>

      {/* NARANJA */}
      <div className="flex items-stretch border-b border-slate-300">
        <div className="flex items-center justify-center w-28 bg-[#ff9900] flex-shrink-0">
          <span className="text-white font-bold text-sm">NARANJA</span>
        </div>
        <div className="flex-1 p-3 text-sm text-justify text-slate-700">
          {textos.NARANJA}
        </div>
      </div>

      {/* AMARILLO */}
      <div className="flex items-stretch">
        <div className="flex items-center justify-center w-28 bg-[#ffff00] flex-shrink-0">
          <span className="text-black font-bold text-sm">AMARILLO</span>
        </div>
        <div className="flex-1 p-3 text-sm text-justify text-slate-700">
          {textos.AMARILLO}
        </div>
      </div>
    </div>
  );
}
