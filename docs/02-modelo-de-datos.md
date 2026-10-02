# 02 — Modelo de datos

## 1. Entidades de dominio (`lib/domain/types.ts`)

```mermaid
erDiagram
    STATION ||--o{ OBSERVACION : "tiene serie"
    STATION ||--o{ CONFIG_RECORD : "configurada por variable"
    STATION ||--o{ FORECAST_INPUT : "recibe pronóstico"
    STATION ||--o{ ALERT : "emite"
    FORECAST_INPUT ||--o{ FORECAST_DIARIO : "promedia"

    STATION {
        string id
        string cuenca
        string estacion
        string rio
        string dz
        float lat
        float lon
        string poblados[]
        number cota
        string cotaFuente
        string preferencia
        string tipo
        string modoPublicacion
        string estado
    }
    OBSERVACION {
        string stationId
        string fecha
        number nivel
        number caudal
    }
    CONFIG_RECORD {
        string stationId
        string variable
        json periodo
        json umbrales
        json tiempoVigenciaHrs
    }
    FORECAST_INPUT {
        string stationId
        string fecha
        string modelo
        number valor
        string usuario
        string padre
    }
    FORECAST_DIARIO {
        string stationId
        string fecha
        number caudalPrevisto
        number nModelos
        string modelos[]
        string precision
    }
    ALERT {
        number nro
        string ca
        string stationId
        string nivel
        string inicio
        string fin
        string descripcion
        string poblados[]
        json serie
        boolean vigente
    }
```

### Tipos principales

| Tipo | Descripción |
| --- | --- |
| `Station` | Ficha de estación: preferencia (caudal/nivel), tipo (avenida/vigilancia), cota, variables, estado, modo de publicación, poblados. |
| `Observation` | Lectura fusionada (nivel + caudal) por fecha. |
| `Lectura` | Serie por variable (`nivel.json` / `caudal.json`). |
| `ConfigRecord` | Tabla de configuración: umbrales + vigencia por (estación, variable, periodo). `periodo.final === null` = vigente. |
| `ForecastInput` | Entrada de un modelo de pronóstico. `padre` = primer día del grupo de 3. |
| `ForecastDiario` | Pronóstico diario = promedio de los modelos de una (estación, fecha). |
| `Alert` | Aviso publicado (documento congelado con `serie`, `umbrales`, `poblados`). |

## 2. Fuentes de datos (PoC)

### JSON estáticos (`data/`)

| Archivo | Contenido |
| --- | --- |
| `stations.json` | Estaciones base (sin cota). |
| `nivel.json`, `caudal.json` | Series horarias por variable (una variable por archivo). |
| `cotas.json` | Catálogo de cotas (cero de la regla) por estación. |
| `config_records.json` | Tabla de umbrales/vigencia base. |
| `forecast_inputs.json` | Entradas de pronóstico base. |
| `alerts.json` | Avisos base (ya traen `serie`). |

### Overlays (`localStorage`)

| Clave | Edita | Implementación |
| --- | --- | --- |
| `senamhi_station_config` | Ficha de estación | `infra/stationConfig.ts` |
| `senamhi_config_records` | Tabla de configuración | `infra/configRecords.ts` |
| `senamhi_forecast_inputs` | Entradas de pronóstico | `infra/catalogos.ts` |
| `senamhi_avisos` | Avisos publicados | `infra/data.ts` |

**Regla de merge**: se lee el JSON base y el overlay; el overlay gana por clave (ej. `stationId|variable`, `stationId|fecha|modelo`).

## 3. Mapeo a PostgreSQL (producción)

```mermaid
erDiagram
    STATIONS ||--o{ OBSERVATIONS : "1:N"
    STATIONS ||--o{ CONFIG_RECORDS : "1:N"
    STATIONS ||--o{ FORECAST_INPUTS : "1:N"
    STATIONS ||--o{ ALERTS : "1:N"
    STATIONS ||--o{ CENTROS_POBLADOS : "N:M"
    FORECAST_INPUTS }o--|| FORECAST_DAILY : "agrega"

    STATIONS {
        varchar id PK
        varchar cuenca
        varchar estacion
        varchar rio
        varchar dz
        numeric lat
        numeric lon
        numeric cota
        varchar cota_fuente
        varchar preferencia
        varchar tipo
        varchar modo_publicacion
        varchar estado
    }
    OBSERVATIONS {
        varchar station_id FK
        timestamp fecha
        numeric nivel
        numeric caudal
    }
    CONFIG_RECORDS {
        varchar station_id FK
        varchar variable
        date periodo_inicio
        date periodo_final
        numeric umb_amarilla
        numeric umb_naranja
        numeric umb_roja
        int vigencia_amarilla
        int vigencia_naranja
        int vigencia_roja
    }
    FORECAST_INPUTS {
        varchar station_id FK
        date fecha
        varchar modelo
        numeric valor
        varchar usuario
        date padre
    }
    ALERTS {
        int nro
        varchar ca
        varchar station_id FK
        varchar nivel
        timestamp inicio
        timestamp fin
        text descripcion
        jsonb poblados
        jsonb serie
        boolean vigente
    }
```

### Notas de migración

- `Observation`/`Lectura` → tabla `observations` (serie horaria, una fila por `station_id + fecha`).
- `ConfigRecord.periodo` → columnas `periodo_inicio` / `periodo_final` (NULL = vigente). La regla `getConfigVigente` (inicio más reciente que cubre la fecha) se implementa con una consulta.
- `ForecastDiario` puede **derivarse** (vista/consulta de `forecast_inputs`) o materializarse en `forecast_daily`.
- `Alert.serie` / `Alert.umbrales` → columnas `jsonb` (snapshot congelado) o tablas hijas.
- Los overlays de `localStorage` desaparecen: todo pasa a transacciones sobre PostgreSQL.
