import type { TipoAviso } from "@/lib/types";
import { PELIGRO } from "@/lib/nivelesPeligro";

export default function LeyendaNiveles({ tipo = "avenida" }: { tipo?: TipoAviso }) {
  const textos = PELIGRO[tipo];

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden text-xs sm:text-[13px]">
      <div className="divide-y divide-gray-200">
        {/* ROJO */}
        <div className="flex flex-col sm:flex-row items-stretch">
          <div className="w-full sm:w-28 bg-[#FF0000] text-white flex items-center justify-center py-3.5 px-2 font-bold tracking-wider text-sm flex-shrink-0">
            ROJO
          </div>
          <div className="p-3 sm:px-4 sm:py-3.5 text-gray-700 bg-white flex items-center flex-grow leading-snug">
            {textos.ROJO}
          </div>
        </div>

        {/* NARANJA */}
        <div className="flex flex-col sm:flex-row items-stretch">
          <div className="w-full sm:w-28 bg-[#FF9900] text-white flex items-center justify-center py-3.5 px-2 font-bold tracking-wider text-sm flex-shrink-0">
            NARANJA
          </div>
          <div className="p-3 sm:px-4 sm:py-3.5 text-gray-700 bg-white flex items-center flex-grow leading-snug">
            {textos.NARANJA}
          </div>
        </div>

        {/* AMARILLO */}
        <div className="flex flex-col sm:flex-row items-stretch">
          <div className="w-full sm:w-28 bg-[#FFFF00] text-black flex items-center justify-center py-3.5 px-2 font-extrabold tracking-wider text-sm flex-shrink-0">
            AMARILLO
          </div>
          <div className="p-3 sm:px-4 sm:py-3.5 text-gray-700 bg-white flex items-center flex-grow leading-snug">
            {textos.AMARILLO}
          </div>
        </div>
      </div>
    </div>
  );
}
