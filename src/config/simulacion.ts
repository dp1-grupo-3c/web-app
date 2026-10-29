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
