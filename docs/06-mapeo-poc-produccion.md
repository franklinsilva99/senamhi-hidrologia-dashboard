# 06 — Mapeo PoC → Producción

Equivalencias capa por capa para pasar de Next.js (PoC) a **Angular + Spring Boot + PostgreSQL**.

## 1. Resumen por capa

| PoC (actual) | Producción (objetivo) |
| --- | --- |
| Next.js App Router + React | Angular (componentes + servicios + routing) |
| TypeScript | Java (Spring Boot) en backend; TypeScript en Angular |
| `lib/domain/*` | Entidades + servicios de dominio (Spring, sin dependencias de framework) |
| `lib/ports/repositorios.ts` | Interfaces de repositorio (puertos de salida) |
| `lib/infra/*` (JSON + localStorage) | Repositorios JPA + controladores REST |
| `data/*.json` | Tablas PostgreSQL (seed data vía migraciones) |
| Overlays `localStorage` | Persistencia transaccional en PostgreSQL |
| Recharts / Leaflet | Chart.js / ngx-charts / Leaflet (Angular) |

## 2. Dominio

| PoC | Spring Boot |
| --- | --- |
| `types.ts` (interfaces) | Clases/records de dominio + entidades JPA |
| `umbrales.ts` → `clasificarNivel` | `UmbralService.clasificar(valor, umbrales, tipo)` |
| `deteccion.ts` → `detectarAvisos` | `DeteccionService.detectar(...)` (Pool 1) |
| `avisos.ts` → `evaluarAccionAviso`, `prepararAviso`, `crearAviso`, `aplicarAviso`, `procesarDeteccion` | `AvisoService` / use cases |
| `pronostico.ts` → `buildForecastDiario` | `PronosticoService.agregarDiario(...)` |
| `nivelesPeligro.ts` | Constantes/enums de dominio |

> Mantener las reglas de negocio idénticas (umbrales relativos, cota solo visual, compuertas crear/mantener/reemplazar).

## 3. Puertos (contratos)

`lib/ports/repositorios.ts` define:

| Puerto | Spring (equivalente) |
| --- | --- |
| `StationRepository` | `StationRepository` (JPA) |
| `ObservacionRepository` | `ObservationRepository` (JPA) |
| `AvisoRepository` | `AlertRepository` (JPA) |
| `PronosticoRepository` | `ForecastRepository` (JPA) |
| `ConfigRepository` | `ConfigRecordRepository` (JPA) |

## 4. Infra (adaptadores)

| PoC | Spring Boot |
| --- | --- |
| `infra/data.ts` (joinSeries, getLatestMerged, getMockNow, loadAlerts/saveAlerts) | Servicios/repositorios + controladores REST |
| `infra/configRecords.ts` (getConfigVigente) | `ConfigRecordRepository.findVigente(stationId, variable, fecha)` |
| `infra/stationConfig.ts` | `StationRepository` + overlay de ficha |
| `infra/catalogos.ts` (forecast) | `ForecastRepository` |
| `infra/cotas.ts` | catálogo `cotas` (o columna en `stations`) |

## 5. Persistencia

| PoC | PostgreSQL |
| --- | --- |
| `data/stations.json` | `stations` |
| `data/nivel.json` + `data/caudal.json` | `observations` (station_id, fecha, nivel, caudal) |
| `data/cotas.json` | `cotas` o columna `cota` |
| `data/config_records.json` | `config_records` |
| `data/forecast_inputs.json` | `forecast_inputs` |
| `data/alerts.json` | `alerts` |
| `localStorage: senamhi_*` | (se elimina; todo transaccional) |

## 6. API REST (sugerida)

| Recurso | Métodos |
| --- | --- |
| `/api/stations` | GET (listar), GET `/{id}`, PUT `/{id}` (ficha) |
| `/api/observations` | GET `?stationId=&horas=`, GET `/latest`, GET `/mock-now` |
| `/api/config-records` | GET (vigente), PUT |
| `/api/forecasts` | GET `/daily?stationId=`, POST `/inputs` |
| `/api/alerts` | GET, POST (publicar), PATCH `/{id}/vigencia` |

## 7. Consideraciones de traspaso

1. **Reloj (`getMockNow`)**: en producción se reemplaza por la fecha real de la última observación en BD (no `new Date()` del servidor necesariamente; usar el reloj de datos).
2. **Cotas**: reemplazar `cotaFuente: "inventario-altitud"` por la cota oficial de la Dirección Zonal (`oficial`), con `cota = nivel_msnm_publicado − lectura_relativa`.
3. **Centros poblados**: hoy desnormalizados en `Station.poblados`; en producción extraer a catálogo `centros_poblados` (N:M) y congelar el snapshot en el aviso.
4. **Auto-publicación**: `procesarDeteccion` puede correr como job programado o al ingerir observaciones.
5. **Control de calidad (QC)**: el PoC consume productos ya limpios; el flujo QC se implementa aparte.
