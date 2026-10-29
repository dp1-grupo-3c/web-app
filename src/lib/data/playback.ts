/**
 * Buffer de reproducción de instantáneas (fotografías) de la simulación.
 *
 * El motor no publica a ritmo constante: mientras planifica se detiene y
 * luego entrega varias fotografías casi a la vez (medido en 5D: huecos de
 * 4,5–5,7 s seguidos de ráfagas de 2–4 fotos con el mismo milisegundosReales).
 * Mostrarlas al llegar produce pausas largas y saltos. Aquí se acumulan N
 * fotos y se reproducen a ritmo uniforme:
 *
 * - La cola se ordena por minuto simulado y descarta duplicados y fotos
 *   anteriores a la ya mostrada (WS y REST pueden repetir o desordenar).
 * - El ritmo base (ms reales por minuto simulado) se estima con una ventana
 *   de llegadas, no foto a foto, para no heredar las ráfagas.
 * - Un control proporcional estira o acorta cada foto según cuánto falte o
 *   sobre respecto del objetivo N: la cola vuelve sola a N sin saltos.
 * - "Alcance": tras un cambio del usuario (avería) se reproduce más rápido
 *   hasta llegar al minuto en que el servidor lo aplicó.
 *
 * Módulo puro: el tiempo llega como parámetro (`now`), así se prueba sin
 * temporizadores. El store (src/lib/data/store.ts) lo conduce.
 */

export type Frame = { minutoSimulado: number; milisegundosReales: number };

export type PlaybackConfig = {
  /** Fotos que se acumulan antes de reproducir (y que el control intenta mantener). */
  target: number;
  /** Tiempo máximo de llenado inicial; luego se reproduce lo que haya. */
  fillTimeoutMs: number;
  /** Multiplicador de velocidad en modo alcance y al vaciar una corrida terminada. */
  catchUpRate: number;
  /** Ganancia y límites del control de nivel de la cola. */
  gain: number;
  shrinkMin: number;
  stretchMax: number;
  /** Llegadas que se usan para estimar el ritmo. */
  rateWindow: number;
  /** Ritmo cuando aún no hay suficientes llegadas (ms reales por minuto simulado). */
  fallbackMsPerMinute: number;
  /** Fotos separadas por menos de esto (milisegundosReales) son de la misma ráfaga. */
  burstGapMs: number;
};

export type Phase = "idle" | "filling" | "playing";

export type PlaybackState<F extends Frame = Frame> = {
  runId: string | null;
  phase: Phase;
  fillDeadline: number;
  /** Pendientes de mostrar, en orden; todas posteriores a `played`. */
  queue: F[];
  /** Foto en pantalla. Durante el llenado es la primera recibida, quieta. */
  played: F | null;
  /** Duración asignada a la transición hacia `played` (la usa la animación). */
  durationMs: number;
  /** Momento en que corresponde mostrar la siguiente. */
  nextAt: number;
  /** Últimas llegadas (minuto, ms reales) para estimar el ritmo. */
  history: Frame[];
  /** Modo alcance hasta este minuto simulado (null = ritmo normal). */
  catchUpTo: number | null;
  /** La corrida terminó: se vacía la cola a ritmo de alcance. */
  ended: boolean;
};

export function idle<F extends Frame>(): PlaybackState<F> {
  return { runId: null, phase: "idle", fillDeadline: 0, queue: [], played: null, durationMs: 0, nextAt: 0, history: [], catchUpTo: null, ended: false };
}

/** Nueva corrida (o reinicio): cola vacía y llenado con tiempo máximo. */
export function start<F extends Frame>(runId: string, now: number, cfg: PlaybackConfig): PlaybackState<F> {
  return { ...idle<F>(), runId, phase: "filling", fillDeadline: now + cfg.fillTimeoutMs };
}

/** Incorpora una foto recibida. Devuelve el mismo objeto si se descarta. */
export function receive<F extends Frame>(s: PlaybackState<F>, frame: F, cfg: PlaybackConfig): PlaybackState<F> {
  if (s.phase === "idle") return s;
  const m = frame.minutoSimulado;
  if (s.played && m <= s.played.minutoSimulado) return s;
  if (s.queue.some((f) => f.minutoSimulado === m)) return s;
  const lastSeen = Math.max(s.played?.minutoSimulado ?? -Infinity, s.queue.at(-1)?.minutoSimulado ?? -Infinity);
  const history = m > lastSeen ? [...s.history, { minutoSimulado: m, milisegundosReales: frame.milisegundosReales }].slice(-cfg.rateWindow) : s.history;
  // Mientras se llena, la primera foto se muestra quieta (detrás del aviso).
  if (!s.played) return { ...s, played: frame, durationMs: 0, history };
  const queue = [...s.queue, frame].sort((a, b) => a.minutoSimulado - b.minutoSimulado);
  return { ...s, queue, history };
}

/**
 * ms reales por minuto simulado, promediados sobre la ventana de llegadas.
 * Se mide entre inicios de ráfaga: si un extremo cayera a mitad de una, el
 * promedio se sesgaría hasta en una ráfaga entera.
 */
export function msPerMinute(s: PlaybackState, cfg: PlaybackConfig): number {
  const h = s.history.filter((f, i, all) => i > 0 && f.milisegundosReales - all[i - 1].milisegundosReales >= cfg.burstGapMs);
  if (h.length < 2) return cfg.fallbackMsPerMinute;
  const dMin = h[h.length - 1].minutoSimulado - h[0].minutoSimulado;
  const dMs = h[h.length - 1].milisegundosReales - h[0].milisegundosReales;
  return dMin > 0 && dMs > 0 ? dMs / dMin : cfg.fallbackMsPerMinute;
}

/**
 * Desfase esperado del buffer (N fotos × lo que dura cada una), estable
 * aunque la cola suba y baje entre ráfagas: es el que se informa en el HUD.
 */
export function expectedLagMs(s: PlaybackState, cfg: PlaybackConfig): number {
  const h = s.history;
  if (s.phase !== "playing" || h.length < 2) return 0;
  const minutesPerFrame = (h[h.length - 1].minutoSimulado - h[0].minutoSimulado) / (h.length - 1);
  return cfg.target * minutesPerFrame * msPerMinute(s, cfg);
}

export const requestCatchUp = <F extends Frame>(s: PlaybackState<F>, minute: number): PlaybackState<F> =>
  s.phase === "idle" ? s : { ...s, catchUpTo: Math.max(s.catchUpTo ?? -Infinity, minute) };

export const markEnded = <F extends Frame>(s: PlaybackState<F>): PlaybackState<F> => (s.ended || s.phase === "idle" ? s : { ...s, ended: true });

/** Avanza el reloj de reproducción. Devuelve el mismo objeto si nada cambió. */
export function advance<F extends Frame>(s: PlaybackState<F>, now: number, cfg: PlaybackConfig): PlaybackState<F> {
  if (s.phase === "idle") return s;
  let next = s;
  if (next.phase === "filling") {
    if (next.queue.length < cfg.target && now < next.fillDeadline && !next.ended) return s;
    next = { ...next, phase: "playing", nextAt: now };
  }
  if (next.catchUpTo != null && next.played && next.played.minutoSimulado >= next.catchUpTo) next = { ...next, catchUpTo: null };
  if (now < next.nextAt || next.queue.length === 0) return next;

  const [frame, ...queue] = next.queue;
  const from = next.played ?? frame;
  const base = Math.max(0, frame.minutoSimulado - from.minutoSimulado) * msPerMinute(next, cfg);
  const fast = next.ended || next.catchUpTo != null;
  const control = fast
    ? 1 / cfg.catchUpRate
    : Math.min(cfg.stretchMax, Math.max(cfg.shrinkMin, 1 + (cfg.gain * (cfg.target - queue.length)) / cfg.target));
  const durationMs = base * control;
  // Si se llegó tarde (cola vacía un rato), se reanuda desde ahora: no se
  // reproducen de golpe las fotos atrasadas.
  const late = now - next.nextAt;
  const nextAt = (late > durationMs ? now : next.nextAt) + durationMs;
  return { ...next, queue, played: frame, durationMs, nextAt };
}
