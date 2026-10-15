# Propuesta: bandeja de avisos a escala de red

**Estado:** propuesta, no implementada. El diseño vigente de `/admin/avisos` se mantiene hasta decidir su implementación.
**Fecha:** 2026-10-15.

## Cómo verla

- Abrir [`maqueta.html`](./maqueta.html) con doble clic en cualquier navegador. Es un solo archivo, sin dependencias ni servidor, e interactivo: pestañas, filtros, selección en lote y panel lateral.
- La red es **simulada (312 estaciones)** para probar la escala. Las 7 estaciones del PoC y sus avisos (#1613–#1618) son los reales; el resto es generado.

## Problema

La página actual mezcla en una misma pantalla la tabla de detección, la vista previa y una lista con todos los avisos. Funciona con 7 estaciones, pero con cientos:

- el operador no ve de un vistazo qué requiere decisión (pendientes) frente a lo que es consulta;
- la lista crece sin filtros útiles (DZ, nivel, tipo, vencimiento) ni orden por tarea;
- no hay acciones en lote (aprobar o cerrar varios a la vez);
- el toggle Habilitar/Deshabilitar permite reactivar un aviso reemplazado y dejar **dos vigentes en la misma estación**;
- un aviso inactivo no dice si fue reemplazado, venció o lo cerró el operador.

## Ciclo de vida (vocabulario único)

```
Detección ──► (automática) ─────────────────► PUBLICADO ──► Reemplazado por #n
         └──► (manual) ──► PENDIENTE ─ Aprobar ──┘      ├─► Vencido
                                    └─ Descartar ─► DESCARTADO  └─► Cerrado por el operador
```

Los mismos términos se usan en el panel principal, el admin y la documentación.

## Estructura de la página

1. **Resumen de la red** (indicadores clicables): Por aprobar, Rojo / Naranja / Amarillo vigentes, Vencen en 24 h, Sin dato reciente, Estaciones normales. Cada uno abre la pestaña con el filtro aplicado.
2. **Pestañas por estado del ciclo**, con contador: Por aprobar · Vigentes · Historial · Descartados.
3. **Filtros**: buscador (estación, río, Nro), Dirección Zonal, nivel, avenida/vaciante y un filtro propio de cada pestaña:
   - Por aprobar: primer aviso / reemplaza a un vigente.
   - Vigentes: vencen en 24 h / 72 h, publicación manual.
   - Historial: reemplazados / vencidos / cerrados.
4. **Tabla densa, ordenable y paginada** (20 por página). Orden por defecto según la tarea: severidad en Por aprobar, próximo vencimiento en Vigentes, más reciente en Historial.
5. **Acciones en lote** (barra inferior al seleccionar): aprobar o descartar pendientes, cerrar vigentes, con un motivo común.
6. **Panel lateral por estación**: pendiente y vigente con sus acciones, último dato y línea de tiempo de todos sus avisos.

## Decisiones que asume (por confirmar)

1. **"Cerrar" reemplaza al toggle Habilitar/Deshabilitar.** Un aviso cerrado no se reabre; si el río sigue alto, la detección crea uno nuevo.
2. **Un descarte vale mientras no cambie la situación.** Si la estación sigue en el mismo nivel y tipo, la detección no vuelve a proponer el aviso; solo si sube de nivel o cambia de tipo.

## Qué implicaría implementarla

| Área | Cambio |
| --- | --- |
| `lib/domain/types.ts` | Motivo de cierre en `Alert` (p. ej. `cierre?: { motivo: "reemplazado" \| "vencido" \| "cerrado"; porNro?: number; detalle?: string; fecha: string }`) y motivo del descarte. |
| `lib/domain/avisos.ts` | `aplicarAviso` / `aprobarAviso` registran `cierre: reemplazado`; nueva `cerrarAviso(base, aviso, motivo)`; `procesarDeteccion` no reabre un descarte con el mismo nivel y tipo. |
| `app/admin/avisos/page.tsx` | Rehacer la página con la estructura de arriba (pestañas, filtros, paginación, selección en lote, panel lateral). Quitar el toggle. |
| `lib/domain/panel.ts`, `app/admin/page.tsx` | Renombrar "Por publicar" a "Por aprobar" y enlazar los indicadores a las pestañas. |
| Producción | Filtros, orden y paginación en el servidor (consulta paginada sobre la tabla `alerts`), no en el cliente. |

## Estado actual con el que convive

Implementado en `refactor-clean-architecture` (ver [`../../05-flujo-avisos.md`](../../05-flujo-avisos.md)):

- avisos pendientes en modo manual, con aprobar y descartar;
- vigencia derivada al leer (`Alert.vence`, `aplicarVencimiento`);
- marca "río normalizado" (el aviso no se cierra solo);
- job horario simulado (`lib/infra/deteccionHoraria.ts`).

La propuesta reorganiza la interfaz sobre ese mismo dominio; no cambia las reglas ya implementadas, salvo las dos decisiones de arriba.
