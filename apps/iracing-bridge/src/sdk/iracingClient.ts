/**
 * Adaptador delgado sobre `irsdk-node` (el wrapper Node.js del SDK nativo
 * de iRacing, que lee la memoria compartida que el simulador expone
 * mientras corre en la misma máquina Windows).
 *
 * Se aísla en este único archivo para que `mapping/*.ts` (la lógica de
 * traducción a `EventoV1`, ya cubierta por el resto del bridge) nunca
 * importe `irsdk-node` directamente: si la biblioteca cambia de API en
 * una versión futura, o si en algún momento se quiere probar una
 * alternativa (`node-irsdk-mjo`, mencionada en la investigación previa a
 * este bridge), solo este archivo necesita cambiar.
 *
 * **Nota de plataforma:** `irsdk-node` (vía `@irsdk-node/native`, un
 * módulo nativo N-API) solo funciona en Windows y solo cuando el proceso
 * de iRacing está corriendo en la MISMA máquina (lee memoria compartida
 * local, no hay transporte de red). Este archivo no puede probarse ni
 * ejecutarse en este entorno de desarrollo (no es Windows con iRacing
 * corriendo) — ver limitaciones documentadas en el README del bridge.
 */

import { IRacingSDK } from "irsdk-node";
import type { RawTelemetrySnapshot, RawSessionInfo } from "./types";

export interface IRacingClient {
  /** `true` si el proceso de iRacing está corriendo y el SDK pudo iniciarse. */
  isSimRunning(): Promise<boolean>;

  /**
   * Espera hasta `timeoutMs` por un nuevo frame de datos del simulador.
   * Devuelve `true` si se recibieron datos frescos, `false` si expiró el
   * timeout sin datos (p. ej. el usuario salió de la sesión).
   */
  waitForData(timeoutMs: number): boolean;

  /** Snapshot completo de todas las variables de telemetría leídas por este bridge (ver `sdk/types.ts`). */
  getTelemetry(): RawTelemetrySnapshot;

  /** SessionInfo (YAML ya parseado) de la sesión actual, o `null` si no hay sesión activa. */
  getSessionInfo(): RawSessionInfo | null;

  /** Número total de autos (`CarIdx`) presentes en la sesión actual. */
  getCarCount(): number;
}

/**
 * Implementación real del `IRacingClient` sobre `irsdk-node`.
 *
 * `autoEnableTelemetry: true` hace que el SDK envíe automáticamente el
 * comando de habilitar telemetría a iRacing si no está ya activada (el
 * usuario no necesita presionar Ctrl+T manualmente en el sim antes de
 * arrancar el bridge).
 */
export function createIRacingClient(): IRacingClient {
  const sdk = new IRacingSDK({ autoEnableTelemetry: true });

  return {
    async isSimRunning(): Promise<boolean> {
      return IRacingSDK.IsSimRunning();
    },

    waitForData(timeoutMs: number): boolean {
      return sdk.waitForData(timeoutMs);
    },

    getTelemetry(): RawTelemetrySnapshot {
      // `getTelemetry()` de `irsdk-node` devuelve TODAS las variables
      // disponibles (>1000, ver comentario en `irsdk-node.ts` sobre su
      // costo de performance); se castea al subconjunto que este bridge
      // realmente lee (`RawTelemetrySnapshot`) en vez de tipar contra el
      // `TelemetryVarList` completo de `@irsdk-node/types`.
      return sdk.getTelemetry() as unknown as RawTelemetrySnapshot;
    },

    getSessionInfo(): RawSessionInfo | null {
      const session = sdk.getSessionData();
      return session as unknown as RawSessionInfo | null;
    },

    getCarCount(): number {
      const driverInfo = sdk.getDriverInfo();
      return driverInfo?.Drivers?.length ?? 0;
    },
  };
}
