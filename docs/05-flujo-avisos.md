# 05 — Flujo del módulo Avisos

Avisos hidrológicos preventivos. El flujo replica dos "pools" del proceso Bizagi.

## 1. Diagrama de flujo (BPMN simplificado)

```mermaid
flowchart TD
    subgraph POOL1["Pool 1 — Detección"]
        D1["detectarAvisos: última lectura vs umbrales"]
        D2["preferencia (caudal/nivel) + ConfigRecord vigente"]
        D3["clasificarNivel(valor relativo, tipo)"]
        D4{"¿excede umbral?"}
        D5["compuerta: ¿nivel distinto del aviso vigente?"]
    end

    subgraph POOL2["Pool 2 — Preparación"]
        P1["prepararAviso: + cota para m.s.n.m., título, vigencia"]
        P2["crearAviso: snapshot de serie + umbrales"]
    end

    subgraph PUB["Publicación"]
        PUB1{"¿existe aviso previo?"}
        PUB2["crear / mantener / reemplazar"]
        PUB3["modoPublicacion: automático / manual"]
    end

    D1 --> D2 --> D3 --> D4
    D4 -- no --> FIN["sin aviso"]
    D4 -- sí --> D5 --> P1 --> P2
    P2 --> PUB1 --> PUB2 --> PUB3
    PUB3 --> SAVE["saveAlerts (overlay senamhi_avisos)"]
```

## 2. Diagrama de secuencia

```mermaid
sequenceDiagram
    participant A as Admin (avisos)
    participant D as domain/deteccion + avisos
    participant CFG as configRecords
    participant I as infra/data
    participant LS as localStorage (senamhi_avisos)

    A->>D: detectarAvisos(stations, latest, getConfigVigente, mockNow)
    D->>CFG: getConfigVigente(id, preferencia, mockNow)
    CFG-->>D: ConfigRecord vigente
    D-->>A: DeteccionAviso[] (umbral/excedido)

    A->>D: procesarDeteccion(alerts, det, deps)
    loop por detección excedida (modo automático)
        D->>D: evaluarAccionAviso (crear/mantener/reemplazar)
        D->>D: crearAviso (preparación + snapshot serie)
        D->>D: aplicarAviso (concat / desactiva anterior)
    end
    D-->>A: next + textos
    A->>I: saveAlerts(next)
    I->>LS: guarda avisos
```

## 3. Reglas de negocio

1. **Pool 1 (detección)** compara el valor **relativo** contra umbrales **relativos** (sin cota). Usa `Station.preferencia` y `getConfigVigente`.
2. **`clasificarNivel`**: avenida = mayor es peor; vigilancia = menor es peor.
3. **Compuertas** (`evaluarAccionAviso`):
   - sin aviso previo → `crear`.
   - con previo y mismo nivel → `mantener` (no hace nada).
   - con previo y distinto nivel → `reemplazar` (desactiva el anterior + crea).
4. **Pool 2 (preparación)**: si es nivel y hay cota, `nivel absoluto = nivel relativo + cota` (solo visualización). La vigencia sale de `ConfigRecord.tiempoVigenciaHrs`.
5. **Publicación**: `procesarDeteccion` solo auto-publica estaciones en `modoPublicacion === "automatico"`. El admin permite publicar manualmente.
6. **Aviso congelado**: `Alert.serie` guarda el snapshot de la serie al emitir; el detalle usa `aviso.serie ?? getSeriesMerged(...)`.

## 4. Puntos de entrada / componentes

| Archivo | Rol |
| --- | --- |
| `lib/domain/deteccion.ts` | `detectarAvisos` (Pool 1). |
| `lib/domain/umbrales.ts` | `clasificarNivel`. |
| `lib/domain/avisos.ts` | `evaluarAccionAviso`, `prepararAviso`, `crearAviso`, `aplicarAviso`, `procesarDeteccion`. |
| `lib/domain/nivelesPeligro.ts` | Peligro/recomendación por nivel y tipo. |
| `app/admin/avisos/page.tsx` | Detección, publicación manual/automática, toggle vigencia, restore. |
| `app/avisos/page.tsx` | Listado público de avisos. |
| `app/avisos/[id]/page.tsx` | Detalle del aviso (con hidrograma congelado). |

## 5. Producción

- La detección (`detectarAvisos`) y las compuertas son **dominio puro** → servicios Spring.
- La auto-publicación se dispara por un job (scheduler) o al ingerir nuevas observaciones.
- `saveAlerts` → transacción que inserta/actualiza la tabla `alerts` (y desactiva el aviso previo en "reemplazar").
- `Alert.serie` → snapshot `jsonb` o referencia a la serie persistida.
