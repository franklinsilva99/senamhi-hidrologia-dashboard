<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cota de estación (nivel absoluto)

- `Station.cota` es la elevación del **cero de la regla** (datum) en m.s.n.m.
- **Nivel absoluto = Nivel relativo + Cota** (Pool 2 del flujo Bizagi).
- La **detección de avisos (Pool 1) compara nivel relativo contra umbrales relativos — NO usa cota**. La cota solo se usa para visualización (hidrograma, tabla, descripción en m.s.n.m.).
- Valores actuales del PoC: tomados de `Estaciones.xlsx` (columna `ALTITUD (m)`), con `cotaFuente: "inventario-altitud"`. Son una **aproximación** (altitud del terreno ≈ cota, error de pocos metros) y **no afectan el nivel de alerta**, solo el desplazamiento del eje. Las cotas viven en `data/cotas.json` y se resuelven en la ficha al leer (`lib/infra/cotas.ts`).
- **En producción**: reemplazar por la cota oficial de la Dirección Zonal (cero de la regla, nivelación GNSS) y marcar `cotaFuente: "oficial"`.
- Validación: `cota = nivel_msnm_publicado − lectura_relativa` si se cuenta con un aviso real.

# Flujo de avisos (Bizagi)

- Pool 1 "Listar avisos": preferencia caudal/nivel → comparar último dato vs umbrales → compuerta "¿nivel del aviso vigente es diferente?" → "¿existe aviso previo?" → "¿publicación automática?".
- Pool 2 "Preparación de Aviso": datos 72h → si nivel y hay cota, sumar cota → hidrograma, título, etiquetas → generar aviso (vigencia según configuración).
- `lib/deteccion.ts`: `detectarAvisos` (usa `Station.preferencia` + `ConfigRecord` vigente).
- `lib/avisos.ts`: `evaluarAccionAviso` → `"mantener" | "crear" | "reemplazar"`, `prepararAviso`, `crearAviso`.
- `lib/umbrales.ts`: `clasificarNivel` (avenida = mayor es peor; vigilancia = menor es peor).
- Modo de publicación por estación (`Station.modoPublicacion`, editable en Configuración general).

# Configuración (tabla + ficha)

- **Tabla de configuración** (`ConfigRecord`): umbrales + tiempo de vigencia por (estación, variable, periodo). `periodo.final === null` = vigente. Datos en `data/config_records.json` + overlay `senamhi_config_records`.
- **Ficha por estación** (`Station`): `preferencia`, `tipo` (avenida/vigilancia), `cota` + `cotaFuente`, `variables`, `estado`, `modoPublicacion`. Overlay `senamhi_station_config`.
- `lib/infra/configRecords.ts`: `getConfigVigente(stationId, variable, fecha)` resuelve el registro vigente según su periodo.
- Detección y avisos leen `Station.preferencia` + `getConfigVigente` (ya no `Thresholds`).

# Centros poblados afectados

- Hoy desnormalizados en la estación (`Station.poblados` nombres + `Station.pobladosGeo` coordenadas). Mantenedor en `/admin/centros-poblados` (overlay `senamhi_station_config`).
- El aviso congela la **lista de nombres** (`Alert.poblados`) al emitir; el mapa público resuelve las coordenadas desde el catálogo de la estación (las coords no cambian).
- En producción: extraer a un **catálogo propio** (`CentroPoblado`: id, nombre, lat/lon, distrito/provincia/departamento) referenciado por la estación (N:M), y congelar el snapshot en el aviso.

# Ingesta de observaciones y publicación (productos separados)

- **Fuente de verdad de las observaciones**: `data/nivel.json` y `data/caudal.json` (series horarias por producto, una variable por archivo). No hay ingesta manual ni overlay de observaciones.
- `lib/infra/data.ts`: `getSeriesMerged(stationId)` une caudal + nivel por fecha (sin duplicar, **ventana móvil de 72 h**), `getLatestMerged()` (última lectura por estación), `getMockNow()` (reloj del mock = fecha más reciente), `getSeries()` (serie completa, sin ventana).
- **El estado (normal/amarilla/naranja/roja) se deriva al leer** contra umbrales y tipo; no se almacena ni en los JSON ni en `Observation`.
- **Sin control de calidad en el PoC**: se consumen los productos ya limpios ("Caudales horarios" + "Niveles vigilados horario"). El flujo QC (`niveles_caudales`) se implementa aparte.
- **Aviso publicado = documento congelado**: `Alert.serie` guarda el snapshot de la serie al emitir; el detalle usa `aviso.serie ?? getSeriesMerged(...)` (los avisos base de `alerts.json` ya traen `serie`).
- **Reloj del mock**: `prepararAviso`/`crearAviso` derivan `fechaEmision`/`inicio` de `getMockNow()` (no `new Date()`), para que la línea de tiempo coincida con la data.
- `app/monitoreo` es **client** para poder leer el overlay de configuración.
- Producción: reemplazar los JSON por la BD de observaciones (Postgres) y `Alert.serie` por la referencia/snapshot persistido.

