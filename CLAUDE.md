@AGENTS.md

# CLAUDE.md

PoC del portal de contingencia hidrológica de SENAMHI (monitoreo, pronóstico, avisos) sobre 7 estaciones.
La lógica se portará a **Spring Boot + Angular + Postgres**: escribir el dominio como si fuera a traducirse a Java.
Las reglas de negocio (cota, flujo Bizagi, umbrales, centros poblados, ingesta) están en `AGENTS.md` (importado arriba); el detalle, en `docs/`.

## Comandos

Gestor: **pnpm** (no usar npm/yarn; hay `pnpm-lock.yaml`).

```bash
pnpm install
pnpm dev                # http://localhost:3000
pnpm lint               # eslint (flat config: next core-web-vitals + typescript)
pnpm exec tsc --noEmit  # chequeo de tipos (no hay script; el build también tipa)
pnpm build              # build de producción
```

- **No hay tests ni framework de tests.** Verificar cambios con `pnpm lint` + `pnpm exec tsc --noEmit`, y probar en `pnpm dev` los flujos tocados.
- Antes de dar por terminado un cambio: lint y tipos en verde.

## Stack

Next.js **16** (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 (`@tailwindcss/postcss`) · Leaflet/react-leaflet · Recharts. Alias de import: `@/*` → raíz del repo.

Next 16 difiere de lo que conoces: consulta `node_modules/next/dist/docs/` antes de usar APIs de Next.

## Arquitectura (`lib/`)

| Capa | Regla |
|---|---|
| `lib/domain/` | Lógica pura: sin React, sin `localStorage`, sin importar JSON. Todo entra por parámetro. Solo importa de `domain/`. |
| `lib/ports/` | Interfaces de repositorio (futuros `@Repository` JPA). |
| `lib/infra/` | Adaptadores: `data/*.json` + overlays en `localStorage` (`senamhi_*`). Único lugar que toca persistencia. |
| `lib/ui/` | Helpers de presentación (tabs, iconos de mapa). |
| `app/`, `components/` | UI. Llaman a `infra` para leer y a `domain` para decidir; no reimplementan reglas. |

- Las páginas que leen overlays de `localStorage` son **client components**; la hidratación se hace en `useEffect` (patrón con `eslint-disable-next-line react-hooks/set-state-in-effect` y comentario de justificación).
- Componentes Leaflet: siempre vía `dynamic(() => import(...), { ssr: false })` (ver `components/Map*Client.tsx`).
- Fechas "actuales": usar `getMockNow()` (`lib/infra/data.ts`), **nunca** `new Date()` en lógica de avisos/series.
- Avisos en vistas: `avisosActualizados()` / `avisosPublicadosActualizados()` (`lib/infra/deteccionHoraria.ts`), no `loadAlerts()` directo.
- Unidad/valor mostrado de nivel y caudal: solo `lib/domain/unidades.ts`.

## Datos

- `data/*.json` es la fuente base (series horarias, umbrales, cotas, estaciones, avisos base, pronóstico). Archivos grandes: no leerlos completos; usar Grep o leer por rangos.
- Cambios de esquema en `lib/domain/types.ts` → revisar JSON en `data/`, overlays en `lib/infra/` (y migración en `lib/infra/legado.ts` si una clave de `localStorage` cambia de forma) y `docs/02-modelo-de-datos.md`.

## Convenciones

- Código, identificadores de dominio, comentarios y docs **en español** (`aviso`, `umbral`, `estacion`...); términos técnicos de React/Next en inglés.
- Commits: Conventional Commits en español con scope: `feat(avisos): ...`, `fix(config): ...`, `refactor(admin/avisos): ...`, `docs(...)`, `chore(data): ...`.
- Si un cambio altera una regla de negocio, actualizar `AGENTS.md` y el doc correspondiente de `docs/` en el mismo commit.
- `main` sigue a GitLab; a GitHub se llega por PR.
