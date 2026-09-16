/**
 * Servidor WebSocket del iRacing_Bridge: mismo protocolo de cable que
 * `apps/generador-demo/src/server/wsServer.ts` (un `EventoV1`
 * serializado a JSON por mensaje, sin framing adicional), para que sea
 * un reemplazo DROP-IN: `apps/dashboard` y `apps/apex-mobile` se conectan
 * exactamente igual (mismo `ws://localhost:PORT`) sin ningún cambio de
 * código en ninguna de las dos apps.
 *
 * Diferencia clave respecto al Generador_Demo: no hay un motor de
 * simulación local que avanzar (`SimulationEngine.tick`) — en su lugar,
 * cada iteración del loop LEE el estado real de iRacing vía
 * `IRacingClient.waitForData`/`getTelemetry`/`getSessionInfo` y lo
 * traduce a `EventoV1` con las funciones de `mapping/*.ts`.
 *
 * Igual que el Generador_Demo, el Evento_Track se construye una única
 * vez (cuando se detecta la primera sesión activa) y se cachea para
 * reenviarlo a cada nueva conexión entrante, sin volver a leer
 * SessionInfo por cada cliente.
 */

import { WebSocketServer } from "ws";
import type { IRacingClient } from "../sdk/iracingClient";
import { mapTelemetryEvent } from "../mapping/telemetry";
import { mapStandingsEvent } from "../mapping/standings";
import { mapSessionEvent } from "../mapping/session";
import { mapTrackEvent } from "../mapping/track";

/** Mismo intervalo (~60Hz) que el Generador_Demo, ver `wsServer.ts`. */
const TICK_INTERVAL_MS = 16.6;

/**
 * Cada cuántos ticks se emite un Evento_Standings (throttling a ~5Hz,
 * igual rango [1Hz, 5Hz] que usa el Generador_Demo, ver
 * `STANDINGS_EMIT_INTERVAL_MS` en `apps/generador-demo/src/simulation/engine.ts`).
 */
const STANDINGS_EVERY_N_TICKS = Math.round(200 / TICK_INTERVAL_MS);

export interface BridgeWsServer {
  readonly wss: WebSocketServer;
  close(): void;
}

/**
 * Arranca el servidor WebSocket del bridge sobre `port`, leyendo datos
 * reales de iRacing vía `client` en cada tick.
 *
 * Si `client.waitForData` no recibe datos frescos dentro del timeout (el
 * usuario no está en una sesión activa, o cerró iRacing), el tick se
 * salta sin emitir ningún evento — a diferencia del Generador_Demo, que
 * SIEMPRE tiene datos disponibles (los genera él mismo), este bridge
 * puede quedarse sin datos en cualquier momento y debe degradar
 * silenciosamente (los clientes conectados simplemente dejan de recibir
 * actualizaciones hasta que iRacing vuelva a estar activo) en vez de
 * lanzar o cerrar las conexiones.
 */
export function startBridgeServer(client: IRacingClient, port: number): BridgeWsServer {
  const wss = new WebSocketServer({ port });

  let trackEventPayload: string | null = null;
  let tickCount = 0;

  wss.on("connection", (socket) => {
    if (trackEventPayload !== null) {
      socket.send(trackEventPayload);
    }
  });

  const intervalId = setInterval(() => {
    void runTick();
  }, TICK_INTERVAL_MS);

  async function runTick(): Promise<void> {
    const hasData = client.waitForData(0);
    if (!hasData) return;

    const timestamp = Date.now();
    const raw = client.getTelemetry();

    if (trackEventPayload === null) {
      const sessionInfo = client.getSessionInfo();
      if (sessionInfo !== null) {
        trackEventPayload = JSON.stringify(mapTrackEvent(sessionInfo, timestamp));
        broadcast(trackEventPayload);
      }
    }

    const payloads: string[] = [JSON.stringify(mapTelemetryEvent(raw, timestamp))];

    tickCount++;
    if (tickCount % STANDINGS_EVERY_N_TICKS === 0) {
      const carCount = client.getCarCount();
      payloads.push(JSON.stringify(mapStandingsEvent(raw, carCount, timestamp)));
      payloads.push(JSON.stringify(mapSessionEvent(raw, timestamp)));
    }

    for (const payload of payloads) {
      broadcast(payload);
    }
  }

  function broadcast(payload: string): void {
    for (const socket of wss.clients) {
      socket.send(payload);
    }
  }

  return {
    wss,
    close(): void {
      clearInterval(intervalId);
      wss.close();
    },
  };
}
