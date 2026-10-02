# 03 — Flujo del módulo Monitoreo

Muestra niveles y/o caudales observados de la red, con el estado derivado al leer.

## 1. Diagrama de flujo

```mermaid
flowchart TD
    A["nivel.json + caudal.json (Lectura[])"] --> B["joinSeries(stationId)"]
    B --> C{"¿tiene nivel y caudal?"}
    C -- no --> X["se descarta"]
    C -- sí --> D["Observation (fecha, nivel, caudal)"]
    D --> E["getSeriesMerged: ventana 72 h"]
    D --> F["getSeries: serie completa"]
    E --> G["getLatestMerged: última lectura por estación"]
    E --> H["getMockNow: fecha más reciente (reloj)"]

    G --> I["MapMonitoreo: color del punto"]
    I --> J["clasificarNivel(valor, umbrales vigentes, tipo)"]
    J --> K["normal / amarilla / naranja / roja"]

    E --> L["HidrogramaMonitoreoPopup"]
    L --> M["ChartHydro (nivel/caudal, horario/diario)"]
```

## 2. Diagrama de secuencia

```mermaid
sequenceDiagram
    participant U as Usuario
    participant P as app/monitoreo
    participant M as MapMonitoreo
    participant D as infra/data.ts
    participant C as configRecords.ts
    participant H as HidrogramaMonitoreoPopup

    U->>P: abre /monitoreo
    P->>M: renderiza mapa
    M->>D: getStationsConfig() + getLatestMerged()
    D-->>M: estaciones + última lectura
    loop por estación
        M->>C: getConfigVigente(id, preferencia, getMockNow())
        C-->>M: ConfigRecord vigente
        M->>M: clasificarNivel(valor, umbrales, tipo) → color
    end
    U->>M: clic en estación
    M->>D: getSeriesMerged(stationId)
    D-->>M: serie 72 h
    M->>H: popup con serie + umbrales + cota
    H-->>U: hidrograma (nivel/caudal)
```

## 3. Reglas de negocio

1. **Estado derivado**: el color del punto y el nivel se calculan **al leer**, comparando la última lectura contra `clasificarNivel`.
2. **Preferencia**: `Station.preferencia` (`caudal` | `nivel`) decide qué variable se compara.
3. **Tipo**: `avenida` (mayor es peor) vs `vigilancia` (menor es peor).
4. **Cota**: solo se usa para el eje en m.s.n.m.; la clasificación usa el valor relativo.
5. **Mantenimiento**: estaciones en `estado === "mantenimiento"` se pintan gris.

## 4. Puntos de entrada / componentes

| Archivo | Rol |
| --- | --- |
| `app/monitoreo/page.tsx` | Página (client) con banner + tabs. |
| `components/MapMonitoreoClient.tsx` | Dynamic import (ssr: false). |
| `components/MapMonitoreo.tsx` | Mapa Leaflet + colores + popup. |
| `components/HidrogramaMonitoreoPopup.tsx` | Tarjeta del hidrograma (radio Nivel/Caudal, Horario/Diario). |
| `components/ChartHydro.tsx` | Gráfico Recharts (con leyenda y Brush). |
| `lib/infra/data.ts` | `joinSeries`, `getSeriesMerged`, `getLatestMerged`, `getMockNow`. |

## 5. Producción

- `nivel.json` / `caudal.json` → tabla `observations` (ingesta de productos horarios ya limpios).
- `getLatestMerged` / `getMockNow` → consultas SQL (última lectura / fecha máxima).
- El estado se sigue derivando en el **dominio** (servicio Spring), no se almacena.
