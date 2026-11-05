# Demostraciones · rutas en el mapa (Fase 8)

Material para decidir cómo mantener legibles las líneas de ruta de la flota sin
saturar el mapa. **Nada de esto está implementado en la app**: son datos
simulados con la retícula de 70 × 50 y la paleta de KindBox.

- `rutas.html`: página interactiva autónoma (sin dependencias). Ábrela en el
  navegador. Pestañas: *Hoy* (referencia), A, B, C, D y *Comparar A–D* (los
  cuatro mapas con los mismos datos). Control de 60 a 300 vehículos; hover y
  clic para enfocar un vehículo; filtros de la alternativa D. Muestra rutas
  dibujadas, nodos SVG de ruta y cuadros por segundo.
  Parámetros de URL: `?mode=actual|a|b|c|d|compare&n=180&seed=11&select=4`.
- `videos/rutas-*.webm`: grabaciones de ~14 s de cada pestaña con el mismo
  guion (hover → selección → en D, zona SO + Moto + tope 40), hechas con
  Playwright. `videos/rutas-compare.gif` es la comparación en baja resolución.

## Alternativas

| | Qué hace | Ventajas | Desventajas | Implementación | Rendimiento |
|---|---|---|---|---|---|
| **Hoy** | Tramo pendiente punteado de todas las unidades; al seleccionar una, las demás al 35 %. | Se ve todo sin interactuar. | Con más de ~60 unidades es una maraña; las rutas se tapan. | — | N rutas punteadas + N destinos. |
| **A · Bajo demanda** | Solo la ruta del vehículo bajo el cursor o seleccionado (y los de un pedido elegido), con recorrido atenuado y pendiente. | Mapa limpio con cualquier flota; la ruta se lee completa; encaja con la selección y los anillos de las Fases 3, 5 y 7. | Sin interactuar no se ve hacia dónde va la flota; en táctil hay que tocar. | Bajo (~0,5 día): GridMap ya sabe qué vehículo está bajo el cursor y cuál está seleccionado. | El mejor: 1–3 rutas sin importar N. |
| **B · Pendiente y recorrido atenuado** | Todas las rutas, finas y sólidas: pendiente al 50 %, recorrido casi transparente; el vehículo enfocado, grueso. | Conserva la vista de conjunto y el avance de cada unidad. | Con 200+ unidades sigue habiendo mucha tinta; dibuja el doble de trazos. | Bajo–medio (~1 día): el recorrido ya llega en la foto; ajustar estilos y capas. | El peor: 2N trazos (sin punteado). |
| **C · Opacidad y grosor por estado** | En reparto: sólida y visible. Regresando vacío: fina y tenue. Averiado: sin ruta y con anillo rojo. | Lo importante destaca sin interactuar; comunica el estado; −30–40 % de tinta. | Leyenda nueva; con flota grande en reparto sigue cargado. | Medio (~1–1,5 días): «regresando» se deduce de no llevar carga a bordo; actualizar leyenda. | ≈ N rutas, más finas; averiados sin ruta. |
| **D · Filtro, zona y tope** | Solo las rutas que pasan el filtro (tipo, zona) y, de ellas, un máximo (las de mayor ocupación); avisa cuántas quedan ocultas. | El usuario decide qué ver; el tope garantiza un máximo; reutiliza los filtros del panel Vehículos. | Más controles; puede ocultar la ruta que interesa; la regla del tope hay que explicarla. | Medio–alto (~2 días): filtros compartidos panel ↔ mapa, zona, tope y aviso. | Acotado por el tope (p. ej. 20) sin importar N. |

### Medición de referencia

Chromium sin GPU, 300 vehículos, una sola pestaña. Los valores absolutos dependen de
la máquina; sirven para comparar las alternativas entre sí.

| | Rutas | Nodos SVG de ruta | Cuadros/s |
|---|---|---|---|
| Hoy | 300 | 600 | 12 |
| A | 1 | 3 | 60 |
| B | 300 | 601 | 20 |
| C | 295 | 423 | 32 |
| D (tope 20) | 21 | 43 | 60 |

Las alternativas se pueden combinar: por ejemplo, **A + D** (sin interacción
solo las rutas del filtro activo con tope; el hover y la selección siempre
muestran la ruta completa) o **C + A** (estado para el panorama, ruta completa
al enfocar).
