/**
 * Valores ajustables de la interfaz de simulación, en un solo lugar.
 *
 * Todo límite numérico, tamaño de buffer, duración o tiempo máximo que usan
 * las pantallas sale de aquí: los ajustes finos se hacen cambiando una
 * constante, sin tocar los componentes. Los tiempos van en milisegundos
 * reales (sufijo _MS) o en minutos simulados (sufijo _MIN).
 */

// ---- Vista de cliente (demostración) -------------------------------------

/** Pedidos de ejemplo que se muestran por cliente mientras el backend no filtre por cliente. */
export const DEMO_ORDERS = 10;

// ---- Flota (tab "Flota" de la simulación) ---------------------------------

/**
 * Rango aceptado para la cantidad de vehículos y la velocidad de cada tipo.
 * El máximo es provisional (arbitrario) hasta que el equipo defina uno real.
 * La velocidad debe ser mayor que 0: el backend rechaza 0 (ParametrosOperacion).
 */
export const FLEET_LIMITS = {
  quantity: { min: 0, max: 100_000, step: 1 },
  speed: { min: 0, minExclusive: true, max: 100_000, step: 1, decimals: 1 },
} as const;

/** Flota del enunciado (data_dp1/flota.txt), para cuando el servidor aún no informa la suya. */
export const FLEET_DEFAULTS = {
  auto: { quantity: 10, speed: 40 },
  moto: { quantity: 15, speed: 25 },
  bicicleta: { quantity: 12, speed: 12 },
} as const;

// ---- Simulación hasta el colapso -----------------------------------------

/**
 * Minutos simulados entre fotografías en la corrida hasta el colapso. Es el
 * valor de ConfiguracionEscenario.colapso (el que usan los experimentos); sin
 * enviarlo, el servicio aplicaría su valor por defecto de 5 min, pensado para
 * 5D, que con el reloj libre y un horizonte de hasta un año satura el canal.
 * El colapso no envía fecha de fin ni duración: corre hasta que un pedido
 * vence o se agotan los datos, y el backend fija K por su cuenta.
 */
export const COLLAPSE_SNAPSHOT_MINUTES = 15;

// ---- Carga de datos ---------------------------------------------------------

/** Tope de cada archivo: spring.servlet.multipart.max-file-size del servidor. */
export const MAX_DATA_FILE_MB = 1;

// ---- Validación de formularios ----------------------------------------------

/**
 * Rango de fechas con datos para simular (data_dp1: ventas y bloqueos de
 * 2026-01 a 2028-12). Ningún endpoint lo expone todavía; si cambia el
 * dataset, ajustar aquí.
 */
export const DATA_DATE_RANGE = { from: "2026-01-01", to: "2028-12-31" } as const;

/** Tope provisional de paquetes por pedido (el enunciado no fija uno). */
export const MAX_PACKAGES_PER_ORDER = 1000;

/** Longitud máxima de la dirección que acepta el backend (SolicitudPedidoOperacion). */
export const ADDRESS_MAX_LENGTH = 300;

// ---- Bloqueos próximos a terminar ------------------------------------------

/**
 * Ventana final, en minutos SIMULADOS, en la que un bloqueo parpadea:
 * min(maxMin, ratio × duración), nunca menos de minMin ni más que la
 * duración. Al medirse en tiempo simulado escala con la velocidad.
 * - maxMin = 30: el salto SA del planificador (30 min); es el horizonte en el
 *   que un plan pudo contar con que el bloqueo ya habría terminado.
 * - ratio = 0.25: un bloqueo corto (p10 ≈ 38 min) no parpadea casi toda su
 *   vida, lo que lo haría parecer inestable.
 * - minMin = 10: dos fotografías (5 min c/u) ≈ 2,5 s reales en 5D, para que
 *   se alcance a notar.
 */
export const BLOCKAGE_ENDING_WINDOW = { maxMin: 30, ratio: 0.25, minMin: 10 } as const;

/** Duración de un ciclo de parpadeo: 1200 ms ≈ 0,8 destellos/s (accesible: < 3/s). */
export const BLOCKAGE_BLINK_PERIOD_MS = 1200;

// ---- Buffer de instantáneas (transiciones de la simulación) ------------------

/**
 * Fotografías que se acumulan antes de reproducirlas. Medido en 5D (una foto
 * cada 5 min simulados): el motor entrega ráfagas de 2–4 fotos cada 4,5–5,7 s,
 * unos 1,25–1,5 s de reproducción por foto. Con 4 fotos (≈5–6 s de retraso) se
 * cubre un hueco típico; con 8 (≈10–12 s) también los largos, a costa de más
 * desfase con lo replanificado.
 */
export const BUFFER_SIZE = { pequeno: 4, grande: 8 } as const;
export type BufferVariant = keyof typeof BUFFER_SIZE;

/**
 * Variante por defecto. Se cambia sin tocar código con ?buffer=pequeno|grande
 * en la URL de la simulación, o al compilar con NEXT_PUBLIC_BUFFER_VARIANT.
 */
export const DEFAULT_BUFFER_VARIANT: BufferVariant =
  process.env.NEXT_PUBLIC_BUFFER_VARIANT === "grande" ? "grande" : "pequeno";

/** Tiempo máximo del aviso "Cargando…" inicial: luego se reproduce lo que haya. */
export const BUFFER_FILL_TIMEOUT_MS = 8000;

/** Cada cuánto se revisa el reloj de reproducción. */
export const PLAYBACK_TICK_MS = 50;

/** Llegadas usadas para estimar el ritmo real (ms por minuto simulado). */
export const PLAYBACK_RATE_WINDOW = 16;

/** Ritmo inicial, antes de medirlo: 5D a K = 240 → 250 ms reales por minuto simulado. */
export const FALLBACK_MS_PER_SIM_MINUTE = 250;

/** Fotos con milisegundosReales a menos de esto entre sí pertenecen a la misma ráfaga. */
export const BURST_GAP_MS = 50;

/**
 * Control del nivel de la cola: cada foto dura base × (1 + gain × (N − cola)/N),
 * acotado a [shrinkMin, stretchMax]. Con poca cola se estira (evita quedarse
 * quieto); con mucha se acorta (recupera el desfase), sin saltos.
 */
export const PLAYBACK_CONTROL = { gain: 0.5, shrinkMin: 0.75, stretchMax: 1.5 } as const;

/**
 * Velocidad de "alcance" tras registrar un cambio (avería) hasta mostrar el
 * minuto en que el servidor lo aplicó; también al vaciar una corrida terminada.
 */
export const CATCHUP_RATE = 3;

/** Tiempo máximo del indicador "Aplicando cambios…" antes de avisar que no se pudo confirmar. */
export const PENDING_CHANGE_TIMEOUT_MS = 20_000;

/** Cuánto se muestra el aviso de error del indicador antes de desaparecer solo. */
export const PENDING_ERROR_VISIBLE_MS = 6000;

// ---- Configuración ampliada de la simulación ------------------------------

/**
 * Atributos de cada tipo de avería, según su regla de reincorporación en el
 * servidor (TipoAveria). T1, T2 y T3OnSite: horas inmovilizada en el lugar;
 * T2Shifts: turnos hasta volver; T3: días de mantenimiento. Se envían con
 * PUT /parametros/averias (ver arrancar en store.ts).
 */
export const BREAKDOWN_DURATION_DEFAULTS = { T1: 2, T2: 4, T2Shifts: 1, T3OnSite: 4, T3: 2 } as const;
export const BREAKDOWN_DURATION_UNIT = { T1: "h", T2: "h", T2Shifts: "t", T3OnSite: "h", T3: "d" } as const;
/**
 * Rangos enteros que acepta el servidor (AtributosAveria y TipoAveria): hasta
 * 1440 min en el lugar, y un turno (480 min) en los tipos con traslado al central.
 */
export const BREAKDOWN_DURATION_LIMITS = {
  T1: { min: 1, max: 24 },
  T2: { min: 1, max: 8 },
  T2Shifts: { min: 1, max: 9 },
  T3OnSite: { min: 1, max: 8 },
  T3: { min: 1, max: 14 },
} as const;

/** Hora de inicio por defecto: las 00:00 del día elegido. */
export const DEFAULT_START_TIME = "00:00";

/**
 * Semáforo de ocupación de vehículos, en % de la capacidad: verde por debajo
 * de `low`, ámbar de `low` a `high` (ambos incluidos) y rojo por encima de
 * `high`. Es el valor inicial de cada tipo de vehículo (configurable).
 */
export const VEHICLE_OCCUPANCY_DEFAULTS = { low: 25, high: 75 } as const;

/** Semáforo FIJO de la ocupación global de la flota (no configurable). */
export const FLEET_OCCUPANCY_BANDS = { low: 25, high: 75 } as const;

/**
 * Semáforo de llenado de almacenes intermedios, en % (opción B: umbrales
 * propios en %, independientes del semáforo en paquetes). Mismo sentido que
 * el semáforo de stock del mapa: más stock = verde. Rojo hasta `low`, ámbar
 * hasta `high`, verde desde `high`. Los valores por defecto equivalen al
 * semáforo en paquetes por defecto (250 / 500) sobre una escala de 1000.
 */
export const WAREHOUSE_FILL_DEFAULTS = { low: 25, high: 50 } as const;

/** Límites inferiores (km) de los rangos de distancia: 0–10, 10–20, 20–40 y 40+. */
export const DISTANCE_BANDS_KM = [0, 10, 20, 40] as const;

/** Ventana, en minutos SIMULADOS, de "pedidos entregados en las últimas 4 horas". */
export const RECENT_DELIVERIES_WINDOW_MIN = 240;

/**
 * Qué parte de la configuración ampliada se envía al servidor. startTime viaja
 * como `inicio` en POST /simulaciones y breakdownDurations con
 * PUT /parametros/averias antes de iniciar.
 */
export const BACKEND_ACCEPTS = { startTime: true, breakdownDurations: true } as const;
