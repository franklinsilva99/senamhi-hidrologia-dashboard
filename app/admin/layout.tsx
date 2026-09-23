"use client";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Página Principal", icon: "🏠", exact: true },
  { href: "/admin/config", label: "Configuración General", icon: "⚙️", disabled: true },
  { href: "/admin/avisos", label: "Avisos", icon: "📋", hasDropdown: true },
  { href: "/monitoreo", label: "Monitoreo", icon: "📈" },
  { href: "/admin/info-diaria", label: "Información Diaria", icon: "📅", hasDropdown: true, disabled: true },
  { href: "/admin/info-mensual", label: "Información Mensual", icon: "📅", hasDropdown: true, disabled: true },
  { href: "/admin/pronostico", label: "Pronóstico", icon: "📊", hasDropdown: true },
  { href: "/admin/manual", label: "Manual de Usuario", icon: "📖", hasDropdown: true, disabled: true },
  { href: "/admin/anexos", label: "Anexos", icon: "📎", disabled: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9fa]">
      {/* Sidebar */}
      <aside className="w-52 bg-[#001e40] text-white flex-shrink-0 flex flex-col overflow-y-auto">
        {/* Logo SC PHISIS */}
        <div className="px-4 py-3 border-b border-gray-600">
          <p className="text-sm font-bold text-white tracking-wide">SC PHISIS</p>
        </div>

        {/* Usuario */}
        <div className="px-4 py-4 border-b border-gray-600 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">PEPE FLORES</p>
            <p className="text-xs text-gray-400">ptlores</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <a
                key={item.label}
                href={item.disabled ? "#" : item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  item.disabled
                    ? "text-gray-500 cursor-not-allowed"
                    : active
                      ? "bg-[#003366] text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.hasDropdown && !item.disabled && (
                  <span className="text-xs text-gray-400">▾</span>
                )}
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Logos institucionales */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">🇵🇪</span>
                </div>
                <div className="text-xs leading-tight">
                  <p className="font-bold text-red-700">PERÚ</p>
                  <p className="text-slate-500">Ministerio del Ambiente</p>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-300" />
              <div className="flex items-center gap-1">
                <span className="text-lg">🌊</span>
                <span className="text-sm font-bold text-[#003366]">Senamhi</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded hover:bg-slate-100 text-slate-500" title="Vista grid">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button className="p-2 rounded hover:bg-slate-100 text-slate-500" title="Usuario">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </button>
            <a href="/" className="p-2 rounded hover:bg-slate-100 text-slate-500" title="Cerrar sesión">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </a>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-5 bg-[#f7f9fa]">
          {children}
        </main>
      </div>
    </div>
  );
}
