<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cota de estación (nivel absoluto)

- `Station.cota` es la elevación del **cero de la regla** (datum) en m.s.n.m.
- **Nivel absoluto = Nivel relativo + Cota** (Pool 2 del flujo Bizagi).
- La **detección de avisos (Pool 1) compara nivel relativo contra umbrales relativos — NO usa cota**. La cota solo se usa para visualización (hidrograma, tabla, descripción en m.s.n.m.).
- Valores actuales del PoC: tomados de `Estaciones.xlsx` (columna `ALTITUD (m)`), con `cotaFuente: "inventario-altitud"`. Son una **aproximación** (altitud del terreno ≈ cota, error de pocos metros) y **no afectan el nivel de alerta**, solo el desplazamiento del eje.
- **En producción**: reemplazar por la cota oficial de la Dirección Zonal (cero de la regla, nivelación GNSS) y marcar `cotaFuente: "oficial"`.
- Validación: `cota = nivel_msnm_publicado − lectura_relativa` si se cuenta con un aviso real.

# Flujo de avisos (Bizagi)

- Pool 1 "Listar avisos": preferencia caudal/nivel → comparar último dato vs umbrales → compuerta "¿nivel del aviso vigente es diferente?" → "¿existe aviso previo?" → "¿publicación automática?".
- Pool 2 "Preparación de Aviso": datos 72h → si nivel y hay cota, sumar cota → hidrograma, título, etiquetas → generar aviso (vigencia según configuración).
- `lib/queries.ts`: `detectarAvisos`, `prepararAviso`, `clasificarUmbral` (avena = mayor es peor; vigilancia = menor es peor).
- `lib/avisos.ts`: `evaluarAccionAviso` → `"mantener" | "crear" | "reemplazar"` (desactivación condicional).
- Modo de publicación (automática/manual) persistido en `localStorage` key `senamhi_modo_publicacion`.

# Ingesta de observaciones y publicación (Solución híbrida)

- **Fuente de verdad de las observaciones**: `data/observations_qc1.json` (histórico) + **overlay** en `localStorage` key `senamhi_observaciones` (ingesta simulada del sensor).
- `lib/data.ts`: `getSeriesMerged(stationId)` (estática + overlay, sin duplicar fecha, **ventana móvil de 72 h**), `getLatestMerged()` (última lectura **`qc1-ok`** por estación), `getMockNow()` (reloj del mock = fecha más reciente), `appendInjectedObs` / `clearInjectedObs`.
- **Detección e hidrograma leen la serie fusionada** → el dato ingestado aparece en el gráfico y coincide con el aviso.
- **QC1 en la ingesta**: si el valor viola `qc1.min/max/deltaMax` respecto a la lectura previa → `origen: "cuarentena"` y **no dispara aviso** (sí se muestra en el gráfico).
- **Aviso publicado = documento congelado**: `Alert.serie` guarda el snapshot de la serie al emitir; el detalle usa `aviso.serie ?? getSeriesMerged(...)` (los 4 avisos base de `alerts.json` ya traen `serie`).
- **Reloj del mock**: `prepararAviso`/`crearAviso` derivan `fechaEmision`/`inicio` de `getMockNow()` (no `new Date()`), para que la línea de tiempo coincida con la data.
- `app/monitoreo` es **client** para poder leer el overlay.
- Producción: reemplazar el overlay por la BD de observaciones y `Alert.serie` por la referencia/snapshot persistido.

