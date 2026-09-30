/**
 * Canal WebSocket de solo lectura hacia /ws/simulacion. Reconecta con
 * espera creciente (1, 2, 4, 8, 15 s) y ofrece un reintento manual tras
 * 6 intentos fallidos.
 */

import type { MensajeVisualizador } from "./types";

export type EstadoCanal = "conectando" | "conectado" | "reconectando" | "desconectado";

export function abrirCanal(
  alRecibir: (m: MensajeVisualizador) => void,
  alCambiar: (e: EstadoCanal) => void,
) {
  let ws: WebSocket | null = null;
  let intentos = 0;
  let espera: ReturnType<typeof setTimeout>;
  let cerrado = false;

  const conectar = () => {
    if (cerrado) return;
    alCambiar(intentos ? "reconectando" : "conectando");
    const url = new URL("/ws/simulacion", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(url);
    ws.onopen = () => { intentos = 0; alCambiar("conectado"); };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.tipo === "corrida" || m.tipo === "instantanea" || m.tipo === "resultado") alRecibir(m);
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
