# SENAMHI — PoC Hidrología (Sede Contingencia Junín)

Portal de contingencia DHI piloto: **monitoreo QC1**, **pronóstico diario** (promedio de modelos) y **avisos hidrológicos**, sobre 7 estaciones reales (Socsi, Chosica, Pisac, Puente Ramis, El Tigre, Cirato, Santo Domingo).

> **Prueba de concepto.** La lógica de negocio está preparada para portarse a **Java (Spring Boot) + Angular + Postgres**.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 · Leaflet / react-leaflet · Recharts
- pnpm

## Funcionalidades

| Ruta | Qué hace |
|---|---|
| `/` | Resumen (estaciones, avisos vigentes, mapa). |
| `/monitoreo` | Mapa de estaciones con estado por umbral QC1 e hidrogramas. |
| `/pronostico` | Pronóstico diario D+1..D+3 como promedio de modelos. |
| `/avisos` | Lista + mapa de avisos; detalle `/avisos/[ca-ce]`. |
| `/admin` | Gestión: avisos (detección, publicación, habilitar/deshabilitar), configuración de estaciones, carga de pronóstico. |

## Arquitectura

Separación en capas dentro de `lib/` (precursora de Clean Architecture):

```
lib/
├── domain/   # lógica pura (sin React, localStorage ni JSON): umbrales, detección, pronóstico, avisos, tipos
├── ports/    # interfaces de repositorio (en Spring serán JPA/Postgres)
├── infra/    # adaptadores actuales: JSON estático + overlay en localStorage
└── ui/       # helpers de presentación (tabs, iconos de mapa)
```

Mapeo a la pila objetivo:

| PoC (`lib/`) | Spring Boot / Angular |
|---|---|
| `domain/` (casos de uso puros) | Servicios de aplicación / dominio |
| `ports/` | Interfaces de repositorio (`@Repository`, JPA) |
| `infra/` | Implementaciones JPA + Postgres |
| `components/` + `app/` | Angular |

## Modelo de datos (`lib/domain/types.ts`)

- **Station** — ficha/ubicación (cuenca, río, cota, departamento/provincia/distritos) + centros poblados afectados (`poblados`/`pobladosGeo`) + `variables`, `preferencia`, `tipo` (avenida/vigilancia), `modoPublicacion`.
- **ConfigRecord** — tabla de configuración por (estación, variable, periodo): `umbrales` + `tiempoVigenciaHrs`.
- **Lectura** — un punto de una serie por variable (`stationId`, `fecha`, `valor`), tal como se guarda en `nivel.json` y `caudal.json`.
- **Observation** — lectura horaria unida (nivel + caudal por fecha). El estado se deriva al leer, no se almacena.
- **ForecastInput / ForecastDiario** — modelos ingresados y pronóstico promedio.
- **Alert** — aviso (título, nivel, vigencia, snapshot de la serie).

## Reglas de negocio clave

### Avisos (flujo reducido)

1. **Clasificar** último dato (relativo) contra umbrales → estado → alimenta *monitoreo*.
2. **Decidir** acción: sin previo → *crear*; mismo nivel → *mantener*; distinto → *reemplazar*.
3. **Preparar** aviso: 72 h + cota (si es nivel) + hidrograma/título/etiquetas/vigencia.
4. **Publicación**: automática o manual (aprobación).

- Preferencia por estación: **caudal** o **nivel**.
- **Avenida** = mayor es peor; **Vigilancia** = menor es peor.
- **Cota**: la detección compara valores *relativos*; la cota solo se suma para mostrar **m.s.n.m.** (`Nivel absoluto = Nivel relativo + Cota`).
- **Modo de publicación por estación**: automática o manual (aprobación).
- **Aviso publicado = snapshot congelado** (`Alert.serie`).

### Pronóstico

- La DZ ingresa 1+ modelos por estación/fecha (nombres genéricos `Modelo 1..4`).
- Regla: 0 modelos → omitir; 1 → ese valor; 2+ → **promedio aritmético**.
- Horizonte D+1..D+3.

## Persistencia (PoC)

Datos base en `data/*.json` + **overlay** en `localStorage` (solo para edición de configuración, avisos y pronóstico):

| Fuente | Contenido |
|---|---|
| `data/nivel.json` | serie horaria de nivel (relativo) por estación |
| `data/caudal.json` | serie horaria de caudal por estación |
| `data/config_records.json` | tabla de configuración (umbrales + vigencia) por estación/variable |
| `data/cotas.json` | cota del cero de la regla por estación (se resuelve en la ficha) |

Overlays de `localStorage`:

| Clave | Contenido |
|---|---|
| `senamhi_avisos` | avisos (base + creados/deshabilitados) |
| `senamhi_forecast_inputs` | modelos de pronóstico cargados |
| `senamhi_config_records` | tabla de configuración (umbrales + vigencia) por estación/variable |
| `senamhi_station_config` | ficha por estación (preferencia, tipo, cota, modo publicación) |

## Cómo correr

```bash
pnpm install
pnpm dev       # http://localhost:3000
pnpm build     # build de producción
pnpm lint      # eslint
```

## Nota de producción

En producción se reemplaza: JSON estáticos (`nivel.json`/`caudal.json`/`cotas.json`) → BD de observaciones (Postgres), `Alert.serie` → snapshot persistido, y la cota aproximada (`cotaFuente: "inventario-altitud"`) → cota oficial de la Dirección Zonal (`cotaFuente: "oficial"`).

Los **centros poblados afectados** hoy están desnormalizados en la estación (`poblados`/`pobladosGeo`). En producción conviene extraerlos a un **catálogo propio** (`CentroPoblado`: id, nombre, lat/lon, distrito/provincia/departamento), referenciado por la estación (relación N:M), y que el aviso congele el snapshot de la lista al emitir.
