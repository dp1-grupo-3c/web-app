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
