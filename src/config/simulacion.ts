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
