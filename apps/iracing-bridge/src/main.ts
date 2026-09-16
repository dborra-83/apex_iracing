/**
 * Punto de entrada del proceso del iRacing_Bridge.
 *
 * Reemplazo DROP-IN de `apps/generador-demo` para usar datos REALES de
 * iRacing en vez de datos sintéticos: emite exactamente el mismo
 * protocolo WebSocket (`EventoV1` por mensaje, ver
 * `server/bridgeServer.ts`), así que `apps/dashboard` y
 * `apps/apex-mobile` no necesitan ningún cambio para consumirlo — solo
 * hay que arrancar este proceso en vez de `apps/generador-demo` (nunca
 * ambos a la vez sobre el mismo puerto).
 *
 * **Requisitos para ejecutar este proceso** (ver también README.md):
 * - Windows (el SDK nativo de iRacing solo existe para Windows).
 * - iRacing debe estar corriendo EN LA MISMA MÁQUINA (el SDK lee memoria
 *   compartida local, no hay transporte de red).
 * - El usuario debe estar en una sesión activa (práctica, qualy o
 *   carrera) para que haya datos de telemetría que leer; sin sesión
 *   activa, el bridge queda escuchando el puerto WebSocket pero no
 *   emite eventos hasta detectar una sesión.
 *
 * Variables de entorno soportadas:
 * - `PORT`: puerto WebSocket, por defecto `8080` (mismo default que
 *   `apps/generador-demo`, para que ambos sean intercambiables sin
 *   cambiar la configuración de las apps consumidoras).
 */

import { IRacingSDK } from "irsdk-node";
import { createIRacingClient } from "./sdk/iracingClient";
import { startBridgeServer } from "./server/bridgeServer";

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main(): Promise<void> {
  const port = readEnvInt("PORT", 8080);

  if (process.platform !== "win32") {
    // eslint-disable-next-line no-console
    console.error(
      "[iracing-bridge] Este proceso solo funciona en Windows (el SDK nativo de " +
        `iRacing no existe para ${process.platform}). Usa apps/generador-demo para desarrollo/demos.`,
    );
    process.exitCode = 1;
    return;
  }

  const isRunning = await IRacingSDK.IsSimRunning();
  if (!isRunning) {
    // eslint-disable-next-line no-console
    console.warn(
      "[iracing-bridge] iRacing no parece estar corriendo todavía. " +
        "El bridge arrancará igual y esperará a que inicie una sesión; " +
        "abrí iRacing y entrá a una sesión (práctica, qualy o carrera).",
    );
  }

  const client = createIRacingClient();
  startBridgeServer(client, port);

  // eslint-disable-next-line no-console
  console.log(
    `[iracing-bridge] escuchando en ws://localhost:${port} — esperando datos reales de iRacing...`,
  );
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[iracing-bridge] error fatal:", err);
  process.exitCode = 1;
});
