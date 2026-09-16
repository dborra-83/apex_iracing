"use client";

import { useEffect } from "react";
import { createWsClient, handleRawMessage } from "@apex/ws-client-core";
import { dispatchEvent } from "../store/dispatchEvent";
import { createTelemetryBatcher } from "../store/telemetryBatcher";
import { useTelemetryStore } from "../store/telemetryStore";

/**
 * URL por defecto del servidor WebSocket del Generador_Demo cuando no se
 * define `NEXT_PUBLIC_GENERADOR_DEMO_WS_URL`. Coincide con el puerto por
 * defecto (`8080`) usado por `apps/generador-demo/src/main.ts`, el MISMO
 * servidor ya consumido por el Dashboard (Requisito 12.5: Apex Mobile no
 * requiere un servidor o endpoint adicional).
 */
const DEFAULT_GENERADOR_DEMO_WS_URL = "ws://localhost:8080";

/**
 * Hook de inicialización de Apex Mobile (tarea 17.1, 17.2), análogo a
 * `apps/dashboard/lib/ws-client/useDashboardConnection.ts`: conecta
 * `createWsClient`/`handleRawMessage` (`@apex/ws-client-core`, Requisito
 * 12.4) con `dispatchEvent` (tarea 17.2) en el mismo flujo ya usado por
 * el Dashboard, reutilizando la MISMA implementación de cliente
 * WebSocket con reconexión automática (Requisito 12.4) sin
 * reimplementarla.
 *
 * Igual que en el Dashboard, los eventos `"telemetry"` (60Hz) se agrupan
 * vía `TelemetryBatcher` en una sola actualización de store por frame de
 * animación; el resto de tipos de evento (`"standings"`, `"session"`,
 * `"track"`, todos a 1-5Hz) se despachan directamente.
 *
 * Se monta una única vez desde `ConnectionProvider`, cercano a la raíz
 * del árbol de Apex Mobile (Requisito 8.4/17.3): al ser un efecto de
 * inicialización sin dependencias de la orientación del dispositivo, un
 * cambio de orientación portrait↔landscape (que solo provoca un reflow
 * de CSS, sin desmontar `ConnectionProvider`) NUNCA reinicia esta
 * conexión ni los stores ya poblados.
 */
export function useApexMobileConnection(): void {
  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_GENERADOR_DEMO_WS_URL ??
      DEFAULT_GENERADOR_DEMO_WS_URL;

    const batcher = createTelemetryBatcher(
      (event) => useTelemetryStore.getState().setTelemetryEvent(event),
    );

    const wsClient = createWsClient(url, (raw) =>
      handleRawMessage(raw, (event) => {
        if (event.type === "telemetry") {
          batcher.push(event);
        } else {
          dispatchEvent(event);
        }
      }),
    );

    return () => {
      wsClient.close();
      batcher.dispose();
    };
  }, []);
}
