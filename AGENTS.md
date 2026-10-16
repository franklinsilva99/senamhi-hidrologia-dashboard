<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cota de estación (nivel absoluto)

- `Station.cota` es la elevación del **cero de la regla** (datum) en m.s.n.m.
- **Nivel absoluto = Nivel relativo + Cota** (Pool 2 del flujo Bizagi).
- La **detección de avisos (Pool 1) compara nivel relativo contra umbrales relativos — NO usa cota**. La cota solo se usa para visualización (hidrograma, tabla, descripción en m.s.n.m.).
- Unidad y valor mostrados: **`lib/domain/unidades.ts`** (`unidadMostrada`, `valorMostrado`) es la única regla — caudal en m³/s; nivel con cota en m.s.n.m.; **nivel sin cota en m (relativo)**. No repetir la regla en componentes. Hoy El Tigre, Cirato y Santo Domingo no tienen cota en `data/cotas.json`.
- Valores actuales del PoC: tomados de `Estaciones.xlsx` (columna `ALTITUD (m)`), con `cotaFuente: "inventario-altitud"`. Son una **aproximación** (altitud del terreno ≈ cota, error de pocos metros) y **no afectan el nivel de alerta**, solo el desplazamiento del eje. Las cotas viven en `data/cotas.json` y se resuelven en la ficha al leer (`lib/infra/cotas.ts`).
- **En producción**: reemplazar por la cota oficial de la Dirección Zonal (cero de la regla, nivelación GNSS) y marcar `cotaFuente: "oficial"`.
- Validación: `cota = nivel_msnm_publicado − lectura_relativa` si se cuenta con un aviso real.

# Flujo de avisos (Bizagi)

- Pool 1 "Listar avisos": preferencia caudal/nivel → comparar último dato vs umbrales → compuerta "¿nivel del aviso vigente es diferente?" → "¿existe aviso previo?" → "¿publicación automática?".
- Pool 2 "Preparación de Aviso": datos 72h → si nivel y hay cota, sumar cota → hidrograma, título, etiquetas → generar aviso (vigencia según configuración).
- `lib/domain/deteccion.ts`: `detectarAvisos` (usa `Station.preferencia` + umbrales activos de avenida y vaciante).
- `lib/domain/avisos.ts`: `evaluarAccionAviso` → `"mantener" | "crear" | "reemplazar"`, `prepararAviso`, `crearAviso`.
- `lib/domain/umbrales.ts`: `clasificarNivel` (avenida = mayor es peor; vaciante = menor es peor).
- Modo de publicación por estación (`Station.modoPublicacion`, editable en Configuración general). En modo **manual** el aviso queda `Alert.estado = "pendiente"` (no público, no cuenta como previo); `aprobarAviso` lo publica y recién ahí desactiva el anterior. Las vistas públicas usan `avisosPublicadosActualizados()`.
- **Disparo**: job horario simulado en `lib/infra/deteccionHoraria.ts` (primera lectura de cada hora de datos ejecuta detección + publicación). Las vistas leen avisos con `avisosActualizados()` / `avisosPublicadosActualizados()`, no con `loadAlerts` directo. En producción, reemplazar por scheduler/ingesta.
- **Vigencia derivada al leer**: `Alert.vence` (emisión + `duracionHoras`); `getAlerts`/`loadAlerts` aplican `aplicarVencimiento` contra `getMockNow()`. Un aviso vencido no cuenta como previo. Al volver el río a la normalidad el aviso **no se cierra solo**: vence por su vigencia o el operador lo deshabilita (el admin lo marca "río normalizado").

# Configuración (tabla + ficha)

- **Tabla de umbrales** (`Umbral`): **una fila por umbral** (estación, variable, tipo, nivel) con `valor`, `vigenciaHrs` (duración del aviso que genera) y `periodo` `{inicio, fin}` en **fechas fijas** (`fin: null` = abierto). Hasta 12 por estación (2 variables × 2 tipos × 3 niveles); un umbral puede repetirse con periodos que no se solapen. Fuera de su periodo, el umbral no genera avisos. Datos en `data/umbrales.json` + overlay `senamhi_umbrales` (lista completa por estación; migra el overlay legado `senamhi_config_records`).
- **Ficha por estación** (`Station`): `preferencia` (única variable que genera avisos), `cota` + `cotaFuente`, `estado`, `modoPublicacion`. Ya **no hay `Station.tipo`**: avenida y vaciante se evalúan a la vez. Overlay `senamhi_station_config`.
- `lib/infra/umbrales.ts`: `getUmbralesActivos(stationId, variable, fecha)` → `UmbralesActivos` (por tipo y nivel, los que cubren la fecha).
- `lib/domain/umbrales.ts`: `clasificarActivos` (gana el umbral excedido más severo; da tipo, nivel y vigencia), `activosEn`, `tipoReferencia` (tipo a dibujar en gráficos).
- Compuerta "mantener": mismo nivel **y** mismo tipo que el aviso vigente; si cambia cualquiera → reemplazar.
- UI `/admin/config`: lista de estaciones + panel (Detección → Umbrales y vigencia [matriz 3×4 de activos + tabla de periodos] → Publicación → Estación).

# Centros poblados afectados

- Hoy desnormalizados en la estación (`Station.poblados` nombres + `Station.pobladosGeo`: coordenadas + `distrito`/`provincia`/`departamento` en **texto libre**, con sugerencias `<datalist>`). Mantenedor: acción 📍 por fila en la tabla de `/admin/config` → `components/ModalCentrosPoblados.tsx` (overlay `senamhi_station_config`); `/admin/centros-poblados` solo redirige ahí. Sistema de contingencia: sin catálogo UBIGEO ni cascadas.
- **Cobertura de la estación calculada**: `Station.departamento` (lista, por estaciones de frontera), `provincia` y `distritos` = unión de la ubicación de sus centros poblados (`lib/domain/cobertura.ts` → `conCobertura`, aplicado en `getStations`/`getStationsConfig`). Si ningún poblado tiene el dato, se usa el valor base.
- El aviso congela la **lista de nombres** (`Alert.poblados`), su ubicación (`Alert.pobladosUbicacion`) y el distrito (`Alert.distrito`, que muestra `TablaDatosAviso`) al emitir; el mapa público resuelve las coordenadas desde el catálogo de la estación (las coords no cambian).
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

