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

// ---- Validación de formularios ----------------------------------------------

/**
 * Rango de fechas con datos para simular (data_dp1: ventas y bloqueos de
 * 2026-01 a 2028-12). Ningún endpoint lo expone todavía; si cambia el
 * dataset, ajustar aquí.
 */
export const DATA_DATE_RANGE = { from: "2026-01-01", to: "2028-12-31" } as const;

/** Tope provisional de paquetes por pedido (el enunciado no fija uno). */
export const MAX_PACKAGES_PER_ORDER = 1000;

/** Longitudes máximas que acepta el backend (SolicitudPedidoOperacion). */
export const CLIENT_CODE_MAX_LENGTH = 100;
export const CLIENT_NAME_MAX_LENGTH = 200;

/** Teléfono: solo dígitos, espacios o "+", con esta cantidad de caracteres. */
export const PHONE_LENGTH = { min: 7, max: 15 } as const;

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
