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
| `/cliente` | Mis pedidos (cliente): pide el número de cliente y lista sus pedidos (`?id=`) · demostración |
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

## Integración y límites actuales

La web ya consume REST y WebSocket del backend `metaheuristics-platform/service`.
En desarrollo, `BACKEND_ORIGIN` apunta por defecto a `http://localhost:8080`.
Los hooks y acciones se apoyan en un store compartido; el mapa utiliza SVG.

En `/operaciones/diarias` se puede iniciar explícitamente una corrida `DIA_A_DIA`,
consultar mapa, pedidos, métricas y averías, y detenerla con confirmación. Avanza a 1×
desde las 00:00 de la fecha elegida con los pedidos del dataset. No se inicia al abrir
la página y no genera averías aleatorias. El backend todavía permite una sola corrida
activa: las simulaciones y la operación diaria no pueden coexistir. La web muestra el
conflicto sin cancelar la corrida de otro usuario.

Faltan registro de pedidos nuevos, continuidad entre días, persistencia/recuperación,
pausa y velocidad en caliente. La vista Cliente es una demostración: pide el número de
cliente y muestra 10 pedidos tomados al azar de la corrida en curso (fijos para
cada número), porque el backend todavía no filtra pedidos por cliente. El registro manual informa
que el pedido no se guardó y conserva el formulario.

Este build requiere el servidor Next; aún no se ha configurado la exportación estática
para el despliegue Nginx descrito en el PDF. El despliegue del otro repositorio todavía
empaqueta su visualizador anterior. El diagnóstico y orden de implementación están en
`metaheuristics-platform/docs/REVISION_ARQUITECTURA.md`.

```bash
npm test        # regresiones de comandos y convivencia entre sesiones
npm run lint
npm run build
```
