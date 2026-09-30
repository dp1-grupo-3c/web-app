# KindBox · Frontend

Interfaz de monitoreo logístico y simulación de KindBox, construida con Next.js 16 (App Router), React 19, Tailwind CSS 4 y lucide-react. Implementa las pantallas del mockup validado (`../mockup-pantallas.html`) siguiendo el estándar GUI `61.std.gui.v01`.

## Cómo ejecutar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # compilación de producción
npm run lint
```

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Bienvenida · selección de perfil |
| `/operaciones` | Menú de operaciones (personal PaqRap) |
| `/operaciones/diarias` | Operaciones en vivo (operador) |
| `/cliente` | Operaciones en vivo (cliente) |
| `/simulacion/5-dias` | Simulación de 5 días |
| `/simulacion/colapso` | Simulación hasta el colapso |

El panel lateral abierto se guarda en la URL con `?panel=` (por ejemplo, `/operaciones/diarias?panel=pedidos`), así que los enlaces se pueden compartir.

## Estructura

```
src/
  app/                  Rutas (App Router) y estilos globales con los tokens del estándar
  components/
    access/             Pantallas de acceso (tarjetas y marco)
    brand/              Logo (SVG oficiales en public/brand)
    domain/             Metadatos de vehículos (ícono, color, etiqueta)
    hud/                Barras superiores: operaciones y simulación
    map/                GridMap (retícula 70 × 50), marcadores y ventanas de detalle
    panels/             Paneles laterales: pedidos, averías, métricas, semáforo, configuración, leyenda, ayuda
    screens/            Pantallas completas con mapa (operador, cliente, simulación)
    simulation/         Inicio guiado, confirmación de cancelación y resumen final
    ui/                 Componentes base del estándar (botones, campos, tarjetas de opción, avisos…)
    workspace/          Distribución [mapa | panel | menú] y sincronización del panel con la URL
  lib/
    types.ts            Modelo de dominio que consumen las pantallas
    constants.ts        Retícula, prioridades, tipos de avería, semáforo por defecto
    data/hooks.ts       LECTURAS: aquí se conecta el backend
    data/actions.ts     ACCIONES: aquí se conectan los comandos
    report.ts           Reporte .txt del resumen de simulación
```
