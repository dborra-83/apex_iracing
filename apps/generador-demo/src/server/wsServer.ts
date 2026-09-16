/**
 * Servidor WebSocket del Generador_Demo: capa de I/O delgada sobre
 * `SimulationEngine`.
 *
 * Ver design.md, sección "b) Servidor WebSocket (`src/server/`)":
 *
 * - Al recibir una nueva conexión, envía inmediatamente el `Evento_Track`
 *   de la sesión en curso (Requisito 7.2). `SimulationEngine.buildTrackEvent`
 *   solo puede invocarse una vez por instancia, así que se llama una única
 *   vez al arrancar el servidor y el `TrackEventV1` resultante se cachea
 *   para reenviarlo a cada nueva conexión, en vez de invocar el método de
 *   nuevo por cliente.
 * - El loop de simulación (`setInterval` a ~16.6ms) vive fuera del ciclo de
 *   vida de cualquier conexión particular: si un cliente se desconecta, el
 *   `SimulationEngine` sigue avanzando y los demás sockets conectados
 *   siguen recibiendo eventos (Requisito 7.3). El intervalo nunca se crea
 *   ni se destruye en los handlers de `connection`/`close` de un socket.
 * - No depende de ningún addon nativo ni de acceso a memoria compartida de
 *   Windows (Requisito 7.4): es Node.js + `ws` puro.
 */

import { WebSocketServer } from "ws";
import type { SimulationEngine } from "../simulation/engine";

/**
 * Intervalo del loop de simulación, en milisegundos (~60Hz), tal como lo
 * exige el Requisito 7.1 ("actualizaciones a una frecuencia de
 * aproximadamente 60 actualizaciones por segundo").
 */
const TICK_INTERVAL_MS = 16.6;

/**
 * Servidor WebSocket en ejecución, devuelto por `startServer`.
 *
 * Envuelve el `WebSocketServer` de `ws` junto con el intervalo del loop de
 * simulación, para que el caller (p. ej. `main.ts`, tarea 6.2, o un test
 * de integración, tarea 6.3) pueda detener ambos de forma conjunta y
 * ordenada con una única llamada a `close()`.
 */
export interface DemoWsServer {
  /** Instancia subyacente de `ws`, expuesta para inspección (p. ej. tests). */
  readonly wss: WebSocketServer;

  /**
   * Detiene el loop de simulación (`clearInterval`) y cierra el
   * `WebSocketServer` subyacente, incluyendo todas las conexiones activas.
   */
  close(): void;
}

/**
 * Arranca el servidor WebSocket del Generador_Demo sobre `port`.
 *
 * Construye el `Evento_Track` una única vez (`engine.buildTrackEvent()`)
 * y lo cachea para enviarlo a cada nueva conexión entrante. Arranca
 * además un loop de simulación independiente de cualquier conexión
 * particular: en cada tick llama a `engine.tick(TICK_INTERVAL_MS)` y hace
 * *broadcast* de los eventos resultantes (serializados a JSON) a todos los
 * sockets actualmente abiertos en `wss.clients`.
 *
 * @param engine - Motor de simulación ya construido; no debe haberse
 *   llamado previamente a `engine.buildTrackEvent()` sobre esta instancia.
 * @param port - Puerto TCP en el que escuchar conexiones WebSocket.
 */
export function startServer(engine: SimulationEngine, port: number): DemoWsServer {
  const wss = new WebSocketServer({ port });

  // Se invoca una única vez por sesión (Requisito 4.3); el resultado se
  // cachea para reenviarlo a cada nueva conexión en vez de volver a
  // llamar a `buildTrackEvent()`, que lanzaría en la segunda invocación.
  const trackEvent = engine.buildTrackEvent();
  const trackEventPayload = JSON.stringify(trackEvent);

  wss.on("connection", (socket) => {
    // Requisito 7.2: al conectar un consumidor, el Generador_Demo debe
    // comenzar a transmitir eventos, empezando por la información del
    // trazado.
    socket.send(trackEventPayload);
  });

  // Requisito 7.3: el loop de simulación no depende de ninguna conexión
  // particular. Se crea una única vez al arrancar el servidor y sigue
  // avanzando el motor y emitiendo a los sockets que permanezcan abiertos
  // en `wss.clients`, independientemente de que otros clientes se hayan
  // desconectado.
  const intervalId = setInterval(() => {
    const events = engine.tick(TICK_INTERVAL_MS);
    if (events.length === 0) return;

    const payloads = events.map((event) => JSON.stringify(event));
    for (const socket of wss.clients) {
      for (const payload of payloads) {
        socket.send(payload);
      }
    }
  }, TICK_INTERVAL_MS);

  return {
    wss,
    close(): void {
      clearInterval(intervalId);
      wss.close();
    },
  };
}
