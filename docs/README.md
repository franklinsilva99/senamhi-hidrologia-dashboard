# Documentación técnica — SENAMHI Hidrología (Dashboard)

Este documento es la **fuente de referencia** para pasar del PoC a desarrollo de producción.

## Contexto

- **PoC actual**: monorepo Next.js (App Router) + React + TypeScript, con persistencia en JSON estático + `localStorage` (overlays).
- **Arquitectura objetivo**: **Angular** (frontend) + **Spring Boot** (backend) + **PostgreSQL**, con **Clean Architecture**.

El PoC ya separa las capas (dominio puro / puertos / adaptadores), por lo que el traspaso a Spring Boot es directo.

## Índice

| Doc | Contenido |
| --- | --- |
| [01-arquitectura.md](./01-arquitectura.md) | Stack, capas (Clean Architecture) y arquitectura objetivo (Angular + Spring Boot + PostgreSQL). |
| [02-modelo-de-datos.md](./02-modelo-de-datos.md) | Entidades de dominio, fuentes de datos (JSON + overlays) y mapeo a tablas PostgreSQL. |
| [03-flujo-monitoreo.md](./03-flujo-monitoreo.md) | Flujo y datos del módulo de Monitoreo (observaciones → estado → mapa + hidrograma). |
| [04-flujo-pronostico.md](./04-flujo-pronostico.md) | Flujo y datos del módulo de Pronóstico (admin → pronóstico diario → hidrograma). |
| [05-flujo-avisos.md](./05-flujo-avisos.md) | Flujo y datos del módulo de Avisos (detección → compuertas → publicación). |
| [06-mapeo-poc-produccion.md](./06-mapeo-poc-produccion.md) | Equivalencias PoC → producción, capa por capa. |

## Reglas transversales importantes

1. **Reloj del mock (`getMockNow`)**: es la fecha más reciente de la serie observada. Todo el dominio (avisos, pronóstico) deriva sus fechas de este reloj, **no** de `new Date()`, para que la línea de tiempo coincida con la data.
2. **Cota ≠ nivel de alerta**: `Station.cota` es la elevación del **cero de la regla**. La **detección compara nivel relativo contra umbrales relativos** (sin cota). La cota solo se usa para **visualización** en m.s.n.m. (`nivel absoluto = nivel relativo + cota`).
3. **Estado derivado al leer**: el estado (normal/amarillo/naranja/rojo) no se almacena; se calcula contra umbrales y tipo al leer.
4. **Overlays**: los JSON son la base; los overlays de `localStorage` ganan por clave y simulan la persistencia editable del admin.
5. **Aviso publicado = documento congelado**: `Alert.serie` guarda el snapshot de la serie al emitir.
