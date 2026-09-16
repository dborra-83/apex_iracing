/**
 * Punto de entrada del proceso del Generador_Demo.
 *
 * Arranca un `SimulationEngine` con una configuración leída de variables
 * de entorno (con valores por defecto razonables) y expone su salida a
 * través del servidor WebSocket implementado en `server/wsServer.ts`.
 *
 * Requisito 7.4: el Generador_Demo debe transmitir eventos como un
 * proceso Node.js corriente, sin depender de ningún agente puente nativo
 * de Windows. Este archivo es deliberadamente una capa de wiring: solo
 * lee configuración, construye el motor y arranca el servidor; toda la
 * lógica de simulación vive en `simulation/` y toda la lógica de
 * transporte vive en `server/wsServer.ts`.
 *
 * Variables de entorno soportadas (todas opcionales):
 * - `PORT`: puerto TCP en el que escuchar conexiones WebSocket. Por
 *   defecto `8080`.
 * - `SEED`: semilla numérica del PRNG del motor de simulación. Por
 *   defecto `42`, una semilla fija en vez de `Date.now()`, para que el
 *   arranque del proceso sea determinista por defecto (útil para demos
 *   reproducibles y para depurar); se puede sobrescribir explícitamente
 *   para obtener una sesión distinta en cada arranque.
 * - `DRIVER_COUNT`: número total de pilotos simulados. Por defecto `20`.
 * - `CLASS_COUNT`: número de clases de pilotos simuladas simultáneamente
 *   (debe ser >= 2 según el Requisito 6.7). Por defecto `2`.
 * - `TRACK_ID`: identificador del trazado a simular. Por defecto
 *   `"demo-track"`.
 */

import { SimulationEngine } from "./simulation/engine";
import { startServer } from "./server/wsServer";
import type { SimulationConfig } from "./simulation/state";

/**
 * Lee una variable de entorno numérica, devolviendo `fallback` si no está
 * definida o no es un número finito.
 */
function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readConfig(): { port: number; simulation: SimulationConfig } {
  const port = readEnvInt("PORT", 8080);
  // Semilla fija por defecto (42): a diferencia de `Date.now()`, garantiza
  // que un arranque sin configuración explícita sea reproducible.
  const seed = readEnvInt("SEED", 42);
  const driverCount = readEnvInt("DRIVER_COUNT", 20);
  const classCount = readEnvInt("CLASS_COUNT", 2);
  const trackId = process.env.TRACK_ID ?? "demo-track";

  return {
    port,
    simulation: { seed, driverCount, classCount, trackId },
  };
}

const { port, simulation } = readConfig();
const engine = new SimulationEngine(simulation);
startServer(engine, port);

// eslint-disable-next-line no-console
console.log(
  `[generador-demo] escuchando en ws://localhost:${port} ` +
    `(seed=${simulation.seed}, driverCount=${simulation.driverCount}, ` +
    `classCount=${simulation.classCount}, trackId=${simulation.trackId})`,
);
