/**
 * Canales WebSocket de solo lectura: /ws/simulacion y /ws/operaciones.
 * Reconectan con espera creciente (1, 2, 4, 8, 15 s) y ofrecen un
 * reintento manual tras 6 intentos fallidos.
 */

import type { MensajeVisualizador, VistaOperacion } from "./types";

export type EstadoCanal = "conectando" | "conectado" | "reconectando" | "desconectado";

function abrirSocket(
  ruta: string,
  alRecibir: (datos: unknown) => void,
  alCambiar: (e: EstadoCanal) => void,
) {
  let ws: WebSocket | null = null;
  let intentos = 0;
  let espera: ReturnType<typeof setTimeout>;
  let cerrado = false;

  const conectar = () => {
    if (cerrado) return;
    alCambiar(intentos ? "reconectando" : "conectando");
    const url = new URL(ruta, location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(url);
    ws.onopen = () => { intentos = 0; alCambiar("conectado"); };
    ws.onmessage = (ev) => {
      try {
        alRecibir(JSON.parse(ev.data));
      } catch { ws?.close(); }
    };
    ws.onerror = () => ws?.close();
    ws.onclose = () => {
      if (cerrado) return;
      intentos++;
      if (intentos >= 6) return alCambiar("desconectado");
      alCambiar("reconectando");
      espera = setTimeout(conectar, Math.min(1000 * 2 ** (intentos - 1), 15_000));
    };
  };
  conectar();
  return {
    cerrar: () => { cerrado = true; clearTimeout(espera); ws?.close(); },
    reintentar: () => { intentos = 0; clearTimeout(espera); ws?.close(); cerrado = false; conectar(); },
  };
}

export function abrirCanal(
  alRecibir: (m: MensajeVisualizador) => void,
  alCambiar: (e: EstadoCanal) => void,
) {
  return abrirSocket("/ws/simulacion", (d) => {
    const m = d as MensajeVisualizador;
    if (m.tipo === "corrida" || m.tipo === "instantanea" || m.tipo === "resultado") alRecibir(m);
  }, alCambiar);
}

/**
 * Suscripción a un contexto operativo. El servidor envía la VistaOperacion
 * completa, sin sobre, al conectar y luego ~1 vez por segundo; cierra la
 * conexión si el contexto no existe.
 */
export function abrirCanalOperacion(
  contextoId: string,
  alRecibir: (v: VistaOperacion) => void,
  alCambiar: (e: EstadoCanal) => void,
) {
  return abrirSocket(`/ws/operaciones?contextoId=${encodeURIComponent(contextoId)}`, (d) => {
    const v = d as VistaOperacion;
    if (v && v.contextoId === contextoId && typeof v.revision === "number") alRecibir(v);
  }, alCambiar);
}
